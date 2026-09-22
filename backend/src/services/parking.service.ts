/**
 * Nghiệp vụ vận hành bãi xe — trái tim của hệ thống: xe vào, xe ra, tính phí, tra cứu lịch sử.
 *
 * Vị trí trong luồng:
 *   pages/ParkingEntry.tsx  -> POST /api/parking/entry     -> entry()
 *   pages/ParkingExit.tsx   -> GET  /api/parking/preview   -> preview()   (báo giá trước)
 *                           -> POST /api/parking/exit      -> exit()      (chốt, thu tiền)
 *   pages/ParkingHistory.tsx-> GET  /api/parking/history   -> history()
 *
 * Ba nguyên tắc xuyên suốt file này:
 *   1. Biển số luôn được chuẩn hoá trước khi so sánh (utils/businessRules.ts).
 *   2. Giá được CHỐT vào bản ghi ngay lúc xe vào, nên đổi bảng giá giữa chừng không ảnh hưởng
 *      những xe đang gửi.
 *   3. Mọi trường hợp cho xe ra đều đi qua cùng một hàm `completeExit`, để luồng thường và
 *      luồng ngoại lệ không bị lệch nghiệp vụ.
 */
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/prisma';
import {
  ParkingEntryInput,
  ParkingExitExceptionInput,
  ParkingExitInput,
} from '../validators/parking.validator';
import {
  areLicensePlatesEqual,
  isSpotCompatibleWithVehicleType,
  normalizeLicensePlate,
} from '../utils/businessRules';
import { calculateParkingFee } from '../utils/feeCalculator';
import {
  calcHourlyPattern,
  calcSpotPreference,
  calcTypeMatch,
  calcZonePreference,
  calcZoneStats,
  scoreSAW,
  DEFAULT_DECAY_ALPHA,
  DEFAULT_SAW_WEIGHTS,
  SpotCandidate,
} from '../utils/smartParkingAlgorithms';
import { knowledgeBase, SAW_WEIGHT_KEYS } from '../expertSystem';
import { syncDueVehicleTypeRates } from './pricing.service';

/**
 * Danh sách lý do cho xe ra "ngoại lệ" — trường hợp không đi theo quy trình bình thường
 * (khách mất vé, vé hỏng, cần giải phóng chỗ gấp, miễn phí...). Mã lý do được ghi vào ghi chú
 * của bản ghi để sau này lọc và thống kê được.
 */
/**
 * Kiểu của đối tượng prisma bên trong một giao dịch (`prisma.$transaction(async (tx) => ...)`).
 * Giống PrismaClient nhưng không có $transaction/$connect — mọi lệnh ghi qua `tx` cùng nằm
 * trong một giao dịch, hoặc thành công hết hoặc rollback hết.
 */
type PrismaTransaction = Prisma.TransactionClient;

/**
 * Tên hai chỉ mục UNIQUE có điều kiện ở tầng DB (migration 20260905000000). Đây là chốt chặn
 * cuối cùng cho race condition; khi chúng chặn thì Prisma ném lỗi P2002 với tên chỉ mục,
 * và `rethrowActiveParkingConflict` dịch sang thông báo nghiệp vụ dễ hiểu cho nhân viên.
 */
const ACTIVE_SPOT_INDEX = 'UX_ParkingRecords_ActiveSpot';
const ACTIVE_PLATE_INDEX = 'UX_ParkingRecords_ActivePlate';

/** Thông báo dùng chung để hai nơi (chốt chỗ ở app và chỉ mục ở DB) nói cùng một câu. */
const SPOT_TAKEN_MESSAGE = 'Chỗ đỗ vừa được nhân viên khác sử dụng, vui lòng chọn chỗ khác';

/**
 * Dịch lỗi vi phạm chỉ mục UNIQUE của DB thành lỗi nghiệp vụ.
 *
 * Vì sao cần: nếu để nguyên, nhân viên sẽ thấy "Unique constraint failed on the constraint:
 * UX_ParkingRecords_ActiveSpot" — đúng về kỹ thuật nhưng vô nghĩa với người dùng cuối. Ở đây
 * đổi thành câu tiếng Việt kèm mã HTTP 409 (Conflict) để frontend biết mà tải lại danh sách chỗ trống.
 *
 * Lỗi không phải P2002 thì ném lại nguyên trạng — không nuốt lỗi lạ.
 */
function rethrowActiveParkingConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = JSON.stringify((error.meta as { target?: unknown } | undefined)?.target ?? '');

    if (target.includes(ACTIVE_PLATE_INDEX)) {
      throw { status: 409, message: 'Xe này đang đỗ trong bãi', code: 'VEHICLE_ALREADY_PARKED' };
    }
    if (target.includes(ACTIVE_SPOT_INDEX)) {
      throw { status: 409, message: SPOT_TAKEN_MESSAGE, code: 'SPOT_TAKEN' };
    }
    // Trường hợp không đọc được tên chỉ mục (khác phiên bản driver): vẫn báo là xung đột đồng thời
    // thay vì để lỗi kỹ thuật lọt ra màn hình.
    throw { status: 409, message: 'Thao tác vừa bị trùng với nhân viên khác, vui lòng thử lại', code: 'CONFLICT' };
  }
  throw error;
}

const EXCEPTION_REASON_LABEL: Record<string, string> = {
  lost_ticket: 'Mất vé / mất phiếu',
  damaged_ticket: 'Vé hỏng / không quét được',
  force_release: 'Giải phóng chỗ bắt buộc',
  fee_waiver: 'Miễn giảm phí (ngoại lệ)',
  other: 'Lý do khác',
};

export class ParkingService {
  /**
   * Tìm xe trong danh mục theo biển số, có bỏ qua khác biệt về dấu gạch / khoảng trắng.
   *
   * Hạn chế: đang tải toàn bộ danh sách xe rồi lọc trong bộ nhớ, vì SQL Server không so khớp
   * trực tiếp được hai biển số khác định dạng. Chấp nhận được với quy mô bãi xe (vài nghìn xe),
   * nhưng nếu dữ liệu lớn hơn thì nên thêm một cột "biển số đã chuẩn hoá" có đánh chỉ mục vào
   * bảng Vehicles và truy vấn thẳng trên cột đó.
   */
  private async findVehicleByNormalizedPlate(licensePlate: string) {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    const vehicles = await prisma.vehicle.findMany({
      include: {
        vehicleType: { select: { name: true, hourlyRate: true, dailyRate: true } },
      },
    });

    return vehicles.find((vehicle) => areLicensePlatesEqual(vehicle.licensePlate, normalizedPlate)) ?? null;
  }

  /**
   * Xe này có đang thuộc một gói còn hiệu lực không? Nếu có thì lượt gửi được miễn phí.
   *
   * So sánh theo mốc 00:00 của ngày hiện tại để gói bắt đầu/kết thúc đúng ngày hôm nay vẫn
   * được tính là còn hiệu lực (nếu so theo thời điểm hiện tại thì gói bắt đầu hôm nay lúc
   * 00:00 vẫn qua, nhưng gói kết thúc hôm nay sẽ bị loại oan).
   */
  private async hasActivePackage(vehicleId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pkgCheck = await prisma.customerPackage.findFirst({
      where: {
        vehicleId,
        status: { not: 'cancelled' },
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { endDate: 'asc' },
    });

    return !!pkgCheck;
  }

  /**
   * Xử lý chung cho MỌI trường hợp xe ra — cả xe ra bình thường (`exit`) lẫn xe ra ngoại lệ
   * (`exitException`). Gom vào một chỗ để hai luồng không bị lệch nghiệp vụ theo thời gian.
   *
   * Các bước thực hiện:
   *   1. Đọc bản ghi đang đỗ (status = 'parked').
   *   2. Tính thời gian gửi và tiền phí (feeCalculator), có xét gói của khách.
   *   3. Áp dụng miễn/ghi đè phí nếu là trường hợp ngoại lệ.
   *   4. Cập nhật bản ghi sang 'completed'.
   *   5. Trả chỗ đỗ về trạng thái trống.
   *   6. Sinh phiếu thanh toán nếu số tiền > 0.
   */
  private async completeExit(params: {
    recordId: number;
    createdByUserId: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
    notesAppend?: string | null;
    feeOverride?: number | null;
    waiveFee?: boolean;
    isException?: boolean;
    exceptionReason?: string;
  }) {
    // Điều kiện status = 'parked' rất quan trọng: nếu chỉ tìm theo id thì bấm "Xe ra" hai lần
    // (mạng chậm, người dùng bấm lại) sẽ tính phí và tạo phiếu thu lần thứ hai cho cùng một lượt.
    const record = await prisma.parkingRecord.findFirst({
      where: { id: params.recordId, status: 'parked' },
      include: {
        vehicleType: { select: { hourlyRate: true, dailyRate: true } },
      },
    });

    if (!record) {
      // Phân biệt "không có bản ghi này" với "có nhưng đã kết thúc rồi". Trường hợp thứ hai xảy ra
      // khi nhân viên bấm "Xe ra" hai lần hoặc hai quầy cùng chốt một lượt — trả 409 để màn hình
      // đóng modal và tải lại danh sách, thay vì báo 404 khiến người dùng tưởng mất dữ liệu.
      const alreadyClosed = await prisma.parkingRecord.findUnique({
        where: { id: params.recordId },
        select: { id: true },
      });
      if (alreadyClosed) {
        throw {
          status: 409,
          message: 'Lượt gửi này vừa được kết thúc bởi thao tác khác',
          code: 'RECORD_ALREADY_CLOSED',
        };
      }
      throw { status: 404, message: 'Không tìm thấy bản ghi' };
    }

    const entryTime = new Date(record.entryTime);
    const exitTime = new Date();
    const durationMs = exitTime.getTime() - entryTime.getTime();

    let hasPackage = false;
    if (record.vehicleId) {
      hasPackage = await this.hasActivePackage(record.vehicleId);
    }

    // Ưu tiên dùng giá ĐÃ CHỐT lúc xe vào (hourlyRateApplied / dailyRateApplied). Nhờ vậy nếu
    // admin đổi bảng giá trong lúc xe đang đỗ thì khách vẫn trả theo giá lúc gửi — đúng cam kết
    // với khách. Chỉ khi bản ghi cũ chưa có cột này (dữ liệu trước khi bổ sung tính năng chốt giá)
    // mới lấy giá hiện hành của loại xe.
    const calc = calculateParkingFee(
      durationMs,
      {
        hourlyRate: Number(record.hourlyRateApplied ?? record.vehicleType.hourlyRate),
        dailyRate: Number(record.dailyRateApplied ?? record.vehicleType.dailyRate),
      },
      { hasPackage }
    );

    // Thứ tự ưu tiên khi quyết định số tiền cuối cùng: miễn phí > ghi đè thủ công > số máy tính ra.
    let fee = calc.fee;
    if (params.waiveFee || params.exceptionReason === 'fee_waiver') {
      fee = 0;
    } else if (typeof params.feeOverride === 'number' && Number.isFinite(params.feeOverride)) {
      // Chặn số âm: nhân viên chỉ được giảm về 0, không được nhập số âm thành ra "trả tiền cho khách".
      fee = Math.max(0, params.feeOverride);
    }

    // Nối thêm ghi chú ngoại lệ vào ghi chú cũ (không ghi đè, để không mất thông tin lúc xe vào).
    // Cắt 500 ký tự cho khớp giới hạn độ dài của cột Notes trong DB.
    const mergedNotes = [record.notes, params.notesAppend].filter(Boolean).join('\n').slice(0, 500);

    // ---- VÙNG TRANH CHẤP ----------------------------------------------------------------
    // Ba việc dưới đây (đóng lượt gửi, trả chỗ, sinh phiếu thu) phải cùng thành công hoặc cùng
    // huỷ. Trước đây chúng là ba lệnh rời: nếu đứt kết nối ở giữa thì lượt gửi đã đóng nhưng chỗ
    // vẫn kẹt "có xe", hoặc đã thu tiền mà bản ghi chưa đóng.
    await prisma
      .$transaction(async (tx) => {
        // Đóng lượt gửi có kèm điều kiện `status: 'parked'` ngay trong lệnh ghi — cùng kỹ thuật
        // như `claimSpotOrThrow`. Nhân viên bấm "Xe ra" hai lần (mạng chậm), hoặc hai nhân viên
        // cùng chốt một lượt, thì chỉ MỘT lệnh đổi được trạng thái; lệnh còn lại count = 0 và
        // dừng tại đây, không tính phí và không sinh phiếu thu lần hai.
        const closed = await tx.parkingRecord.updateMany({
          where: { id: params.recordId, status: 'parked' },
          data: {
            exitTime,
            duration: calc.durationMinutes,
            fee: new Decimal(fee),
            status: 'completed',
            ...(mergedNotes ? { notes: mergedNotes } : {}),
          },
        });

        if (closed.count === 0) {
          throw {
            status: 409,
            message: 'Lượt gửi này vừa được kết thúc bởi thao tác khác',
            code: 'RECORD_ALREADY_CLOSED',
          };
        }

        // Trả chỗ đỗ về trạng thái trống để xe sau vào được. Không làm bước này thì chỗ sẽ bị
        // "kẹt" ở trạng thái đang có xe dù xe đã rời bãi.
        if (record.parkingSpotId) {
          await tx.parkingSpot.update({
            where: { id: record.parkingSpotId },
            data: { status: 'available' },
          });
        }

        // Chỉ sinh phiếu thu khi thực sự có tiền. Lượt miễn phí (khách có gói, hoặc được miễn) vẫn
        // được ghi nhận đầy đủ trong ParkingRecord để báo cáo đếm lượt xe, chỉ là không có giao dịch thu.
        if (fee > 0) {
          await tx.payment.create({
            data: {
              parkingRecordId: params.recordId,
              amount: new Decimal(fee),
              paymentMethod: params.paymentMethod || 'cash',
              paymentType: 'parking',
              createdBy: params.createdByUserId,
              notes: params.isException
                ? `Checkout ngoại lệ: ${EXCEPTION_REASON_LABEL[params.exceptionReason || 'other'] || params.exceptionReason}`
                : null,
            },
          });
        }
      })
      .catch(rethrowActiveParkingConflict);

    return {
      message: params.isException ? 'Checkout ngoại lệ thành công' : 'Ghi nhận xe ra thành công',
      data: {
        entryTime,
        exitTime,
        durationMinutes: calc.durationMinutes,
        fee,
        hasPackage: fee === 0 && hasPackage && !params.waiveFee && params.exceptionReason !== 'fee_waiver',
        isException: !!params.isException,
        exceptionReason: params.exceptionReason || null,
        waived: !!(params.waiveFee || params.exceptionReason === 'fee_waiver'),
      },
    };
  }

  /**
   * Danh sách lượt gửi xe, mặc định là các xe ĐANG đỗ trong bãi.
   * Dùng cho màn hình Xe ra (chọn xe để cho ra) và bảng theo dõi ở Tổng quan.
   */
  async findAll(params: {
    status?: string;
    search?: string;
    zoneId?: number;
    vehicleTypeId?: number;
    from?: string;
    to?: string;
  }) {
    const { status, search, zoneId, vehicleTypeId, from, to } = params;
    // Cú pháp `...(dieu_kien ? { ... } : {})` là cách ghép điều kiện lọc động cho Prisma: bộ lọc
    // nào người dùng không chọn thì không xuất hiện trong câu truy vấn, thay vì phải viết nhiều
    // nhánh if để dựng câu lệnh.
    return prisma.parkingRecord.findMany({
      where: {
        status: status || 'parked',
        ...(vehicleTypeId ? { vehicleTypeId } : {}),
        ...(zoneId ? { parkingSpot: { zoneId } } : {}),
        ...((from || to)
          ? {
              entryTime: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { licensePlate: { contains: search } },
                { vehicle: { customer: { fullName: { contains: search } } } },
                { parkingSpot: { spotNumber: { contains: search } } },
                { parkingSpot: { zone: { name: { contains: search } } } },
              ],
            }
          : {}),
      },
      include: {
        vehicleType: { select: { name: true } },
        parkingSpot: {
          select: {
            spotNumber: true,
            zone: { select: { name: true } },
          },
        },
        vehicle: {
          select: {
            brand: true,
            model: true,
            color: true,
            customer: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { entryTime: 'desc' },
    });
  }

  /**
   * XE VÀO — ghi nhận một lượt gửi xe mới.
   *
   * Luồng: pages/ParkingEntry.tsx -> POST /api/parking/entry -> hàm này.
   *
   * Các bước kiểm tra trước khi cho vào:
   *   1. Áp dụng bảng giá mới nếu đã đến ngày hiệu lực.
   *   2. Xe này chưa đang đỗ trong bãi (chống ghi nhận trùng).
   *   3. Loại xe có tồn tại.
   *   4. Bãi còn chỗ phù hợp với loại xe đó.
   *   5. Chỗ nhân viên chọn đang trống và vừa với loại xe.
   * Qua hết mới tạo bản ghi và đánh dấu chỗ đỗ là đã có xe.
   */
  async entry(data: ParkingEntryInput, createdByUserId: number) {
    // Đồng bộ giá đến hạn ngay tại đây, vì bước dưới sẽ CHỐT giá vào bản ghi. Nếu bỏ qua, xe vào
    // đúng ngày đổi giá sẽ bị chốt nhầm theo giá cũ và giữ giá sai đó cho tới lúc ra.
    await syncDueVehicleTypeRates();

    const normalizedPlate = normalizeLicensePlate(data.licensePlate);

    const parkedRecords = await prisma.parkingRecord.findMany({
      where: { status: 'parked' },
      select: { id: true, licensePlate: true },
    });
    const alreadyParked = parkedRecords.find((record) => areLicensePlatesEqual(record.licensePlate, normalizedPlate));

    // Chặn ghi nhận trùng: cùng một biển số không thể vừa đang đỗ vừa vào lần nữa. Nếu bỏ qua,
    // xe sẽ chiếm hai chỗ và lúc cho ra không biết đóng lượt nào.
    if (alreadyParked) {
      throw { status: 400, message: 'Xe này đang đỗ trong bãi' };
    }

    // Promise.all chạy 4 truy vấn ĐỒNG THỜI thay vì lần lượt: chúng độc lập nhau nên tổng thời
    // gian chờ bằng truy vấn chậm nhất, không phải tổng của cả bốn.
    const [vehicle, requestedVehicleType, selectedSpot, availableSpots] = await Promise.all([
      this.findVehicleByNormalizedPlate(normalizedPlate),
      prisma.vehicleType.findUnique({
        where: { id: data.vehicleTypeId },
        select: { id: true, name: true, hourlyRate: true, dailyRate: true },
      }),
      prisma.parkingSpot.findUnique({
        where: { id: data.parkingSpotId },
        include: {
          zone: {
            select: { name: true, description: true },
          },
        },
      }),
      prisma.parkingSpot.findMany({
        where: { status: 'available' },
        include: {
          zone: {
            select: { name: true, description: true },
          },
        },
      }),
    ]);

    if (!requestedVehicleType) {
      throw { status: 400, message: 'Loại xe không tồn tại' };
    }

    // Nếu xe đã có trong danh mục thì tin loại xe đã đăng ký, không tin loại xe nhân viên chọn
    // trên form — tránh việc chọn nhầm loại rẻ hơn cho một chiếc ô tô đã khai báo sẵn.
    const effectiveVehicleTypeId = vehicle?.vehicleTypeId ?? data.vehicleTypeId;
    const effectiveVehicleTypeName = vehicle?.vehicleType.name ?? requestedVehicleType.name;
    // Chốt giá tại thời điểm xe vào — không bị ảnh hưởng nếu admin đổi giá trong lúc xe đang đỗ.
    const effectiveHourlyRate = vehicle?.vehicleType.hourlyRate ?? requestedVehicleType.hourlyRate;
    const effectiveDailyRate = vehicle?.vehicleType.dailyRate ?? requestedVehicleType.dailyRate;
    const compatibleAvailableSpots = availableSpots.filter((spot) =>
      isSpotCompatibleWithVehicleType(spot, effectiveVehicleTypeName)
    );

    // Phân biệt hai thông báo lỗi: "hết chỗ phù hợp cho loại xe này" (bãi còn chỗ nhưng không
    // vừa) khác với "chỗ vừa chọn đã có xe" — nhân viên biết ngay nên chọn lại hay báo khách quay xe.
    if (compatibleAvailableSpots.length === 0) {
      throw { status: 400, message: `Đã hết chỗ đỗ phù hợp cho loại xe ${effectiveVehicleTypeName}` };
    }

    // Tách ba tình huống thay vì gộp một câu chung, vì cách xử lý ở màn hình khác hẳn nhau:
    //   - Không tồn tại  -> dữ liệu hỏng / form cũ, nhân viên phải tải lại trang (400).
    //   - Đã có xe       -> XUNG ĐỘT ĐỒNG THỜI: chỗ vừa bị quầy khác lấy. Trả 409 để frontend tự
    //                       tải lại sơ đồ chỗ trống và xoá ô chọn chỗ, thay vì báo lỗi đỏ vô nghĩa.
    //   - Trạng thái khác (bảo trì...) -> lỗi nhập liệu thật sự (400).
    if (!selectedSpot) {
      throw { status: 400, message: 'Chỗ đỗ không tồn tại' };
    }
    if (selectedSpot.status === 'occupied') {
      throw { status: 409, message: SPOT_TAKEN_MESSAGE, code: 'SPOT_TAKEN' };
    }
    if (selectedSpot.status !== 'available') {
      throw { status: 400, message: 'Chỗ đỗ đang không khả dụng (bảo trì hoặc đã khoá)' };
    }

    if (!isSpotCompatibleWithVehicleType(selectedSpot, effectiveVehicleTypeName)) {
      throw { status: 400, message: `Chỗ đỗ đã chọn không phù hợp với loại xe ${effectiveVehicleTypeName}` };
    }

    // ---- VÙNG TRANH CHẤP ----------------------------------------------------------------
    // Toàn bộ kiểm tra ở trên chỉ lọc sớm để báo lỗi cho dễ hiểu; chúng KHÔNG bảo đảm được
    // tính đúng đắn khi hai nhân viên bấm cùng lúc, vì giữa lúc đọc và lúc ghi có khoảng trễ.
    // Việc chốt chỗ phải làm nguyên tử trong một giao dịch (xem `claimSpotOrThrow`).
    const record = await prisma.$transaction(async (tx) => {
      await this.claimSpotOrThrow(tx, data.parkingSpotId);

      // Ghi lại giá đang áp dụng vào chính bản ghi (hourlyRateApplied / dailyRateApplied). Đây là
      // điểm mấu chốt để lúc xe ra tính đúng giá của thời điểm gửi, dù bảng giá đã thay đổi.
      return tx.parkingRecord.create({
        data: {
          vehicleId: vehicle?.id ?? null,
          licensePlate: normalizedPlate,
          vehicleTypeId: effectiveVehicleTypeId,
          parkingSpotId: data.parkingSpotId,
          // Ghi lại gợi ý của thuật toán để sau này đo acceptance rate. Trường thống kê thuần
          // tuý — không tham gia nghiệp vụ chốt chỗ ở trên.
          suggestedSpotId: data.suggestedSpotId ?? null,
          notes: data.notes ?? null,
          createdBy: createdByUserId,
          hourlyRateApplied: effectiveHourlyRate,
          dailyRateApplied: effectiveDailyRate,
        },
      });
    }).catch(rethrowActiveParkingConflict);

    return { message: 'Ghi nhận xe vào thành công', id: record.id };
  }

  /**
   * CHỐT CHỖ ĐỖ một cách nguyên tử — mấu chốt chống tranh chấp khi hai nhân viên cùng chọn
   * một chỗ.
   *
   * Cách làm: dùng `updateMany` kèm điều kiện `status: 'available'` ngay trong câu lệnh ghi.
   * Nó dịch ra đúng một câu UPDATE ... WHERE Id=? AND Status='available'. SQL Server khoá dòng
   * đó rồi mới xét lại điều kiện, nên trong hai yêu cầu đồng thời chỉ MỘT yêu cầu đổi được
   * trạng thái (count = 1), yêu cầu còn lại nhận count = 0 và bị từ chối.
   *
   * So với cách cũ (`findUnique` kiểm tra status rồi `update`): hai bước tách rời có khoảng trễ
   * ở giữa nên cả hai đều đọc thấy "còn trống" và đều ghi đè được — đó chính là lỗi race condition.
   *
   * Trả về 409 (Conflict) chứ không phải 400: đây không phải nhân viên nhập sai, mà là chỗ vừa
   * bị người khác lấy mất trong tích tắc — frontend dựa vào mã này để tự tải lại sơ đồ chỗ trống.
   */
  private async claimSpotOrThrow(tx: PrismaTransaction, parkingSpotId: number) {
    const claimed = await tx.parkingSpot.updateMany({
      where: { id: parkingSpotId, status: 'available' },
      data: { status: 'occupied' },
    });

    if (claimed.count === 0) {
      throw { status: 409, message: SPOT_TAKEN_MESSAGE, code: 'SPOT_TAKEN' };
    }
  }

  /** XE RA thông thường: tính phí theo công thức, thu tiền, trả chỗ. */
  async exit(data: ParkingExitInput, createdByUserId: number) {
    return this.completeExit({
      recordId: data.parkingRecordId,
      createdByUserId,
      paymentMethod: data.paymentMethod || 'cash',
    });
  }

  /**
   * XE RA NGOẠI LỆ — khách mất vé, vé hỏng, cần giải phóng chỗ, hoặc được miễn phí.
   *
   * Vẫn đi qua đúng `completeExit` như luồng thường, chỉ khác ở chỗ ghi thêm dòng ghi chú có
   * gắn mã `[NGOAI_LE:<mã lý do>]`. Nhờ tiền tố này mà sau đó lọc ra được toàn bộ lượt ngoại lệ
   * để đối soát (xem `plateHistory` và báo cáo).
   */
  async exitException(data: ParkingExitExceptionInput, createdByUserId: number) {
    const reasonLabel = EXCEPTION_REASON_LABEL[data.exceptionReason] || data.exceptionReason;
    const noteLine = `[NGOAI_LE:${data.exceptionReason}] ${reasonLabel} — ${data.exceptionNote.trim()}`;

    return this.completeExit({
      recordId: data.parkingRecordId,
      createdByUserId,
      paymentMethod: data.paymentMethod || 'cash',
      notesAppend: noteLine,
      feeOverride: data.overrideFee ?? null,
      waiveFee: data.waiveFee || data.exceptionReason === 'fee_waiver',
      isException: true,
      exceptionReason: data.exceptionReason,
    });
  }

  /**
   * XEM TRƯỚC số tiền phải trả mà CHƯA cho xe ra.
   *
   * Dùng ở màn hình Xe ra để nhân viên báo giá cho khách trước khi bấm xác nhận. Hàm này chỉ đọc
   * dữ liệu, không cập nhật gì — bấm xem trước bao nhiêu lần cũng không ảnh hưởng.
   *
   * Trả kèm ngày hết hạn gói và số ngày còn lại để màn hình nhắc khách gia hạn đúng lúc.
   */
  async preview(parkingRecordId: number) {
    const record = await prisma.parkingRecord.findFirst({
      where: { id: parkingRecordId, status: 'parked' },
      include: {
        vehicleType: { select: { hourlyRate: true, dailyRate: true } },
      },
    });

    if (!record) {
      throw { status: 404, message: 'Không tìm thấy bản ghi' };
    }

    const entryTime = new Date(record.entryTime);
    const now = new Date();
    const durationMs = now.getTime() - entryTime.getTime();

    let hasPackage = false;
    let packageEndDate: Date | null = null;
    let daysUntilExpiry: number | null = null;

    if (record.vehicleId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const pkgCheck = await prisma.customerPackage.findFirst({
        where: {
          vehicleId: record.vehicleId,
          status: { not: 'cancelled' },
          startDate: { lte: today },
          endDate: { gte: today },
        },
        orderBy: { endDate: 'asc' },
      });
      hasPackage = !!pkgCheck;
      if (pkgCheck) {
        packageEndDate = new Date(pkgCheck.endDate);
        daysUntilExpiry = Math.ceil(
          (packageEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    const calc = calculateParkingFee(
      durationMs,
      {
        hourlyRate: Number(record.hourlyRateApplied ?? record.vehicleType.hourlyRate),
        dailyRate: Number(record.dailyRateApplied ?? record.vehicleType.dailyRate),
      },
      { hasPackage }
    );

    return {
      fee: calc.fee,
      hasPackage,
      durationMinutes: calc.durationMinutes,
      packageEndDate,
      daysUntilExpiry,
      cappedByDailyRate: calc.cappedByDailyRate,
      billedDays: calc.billedDays,
    };
  }

  /**
   * Lịch sử các lượt gửi xe ĐÃ HOÀN TẤT, có phân trang và nhiều bộ lọc.
   * Dùng cho màn hình Lịch sử (pages/ParkingHistory.tsx).
   */
  async history(params: {
    from?: string;
    to?: string;
    licensePlate?: string;
    zoneId?: number;
    vehicleTypeId?: number;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { from, to, licensePlate, zoneId, vehicleTypeId, search } = params;
    const normalizedPlate = licensePlate ? normalizeLicensePlate(licensePlate) : '';
    // Chặn hai đầu tham số phân trang do client gửi lên: trang nhỏ nhất là 1, và mỗi trang tối đa
    // 200 bản ghi. Không chặn thì một request pageSize=1000000 có thể kéo cả bảng và làm treo server.
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 20));

    const where = {
        status: 'completed',
        ...((from || to)
          ? {
              OR: [
                {
                  exitTime: {
                    ...(from ? { gte: new Date(from) } : {}),
                    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
                  },
                },
                {
                  entryTime: {
                    ...(from ? { gte: new Date(from) } : {}),
                    ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
                  },
                },
              ],
            }
          : {}),
        ...(normalizedPlate ? { licensePlate: { contains: normalizedPlate } } : {}),
        ...(vehicleTypeId ? { vehicleTypeId } : {}),
        ...(zoneId ? { parkingSpot: { zoneId } } : {}),
        ...(search
          ? {
              OR: [
                { licensePlate: { contains: search } },
                { vehicle: { customer: { fullName: { contains: search } } } },
                { parkingSpot: { spotNumber: { contains: search } } },
                { parkingSpot: { zone: { name: { contains: search } } } },
                { notes: { contains: search } },
              ],
            }
          : {}),
    };

    // Lấy dữ liệu trang hiện tại và ĐẾM tổng số bản ghi cùng lúc. Tổng số là bắt buộc để giao
    // diện vẽ đúng thanh phân trang; dùng chung biến `where` nên hai truy vấn luôn cùng bộ lọc.
    const [data, total] = await Promise.all([
      prisma.parkingRecord.findMany({
        where,
        include: {
          vehicleType: { select: { name: true } },
          parkingSpot: {
            select: {
              spotNumber: true,
              zone: { select: { name: true } },
            },
          },
          vehicle: {
            select: {
              customer: { select: { fullName: true } },
            },
          },
        },
        orderBy: { exitTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.parkingRecord.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * Toàn bộ lịch sử ra/vào của MỘT biển số — dùng khi cần tra cứu một xe cụ thể.
   * Trả kèm số liệu tổng hợp: tổng lượt, đang đỗ, đã hoàn tất, số lần ra ngoại lệ.
   */
  async plateHistory(licensePlate: string) {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    if (!normalizedPlate) {
      throw { status: 400, message: 'Vui lòng nhập biển số hợp lệ' };
    }

    // Một số bản ghi cũ lưu biển số kèm dấu gạch/khoảng trắng ("51H4-23456"), bản ghi mới lưu đã
    // chuẩn hoá ("51H423456") — contains() không xử lý được sai khác định dạng này nên tìm bằng
    // vehicleId (chính xác tuyệt đối) + so khớp text đã bỏ dấu gạch/khoảng trắng ngay tại SQL Server.
    const vehicle = await this.findVehicleByNormalizedPlate(normalizedPlate);

    const matchedByText = await prisma.$queryRaw<{ Id: number }[]>`
      SELECT Id FROM ParkingRecords
      WHERE REPLACE(REPLACE(REPLACE(LicensePlate, '-', ''), '.', ''), ' ', '') = ${normalizedPlate}
    `;
    const matchedIds = matchedByText.map((r) => r.Id);

    const records = matchedIds.length === 0 && !vehicle
      ? []
      : await prisma.parkingRecord.findMany({
          where: {
            OR: [
              ...(vehicle ? [{ vehicleId: vehicle.id }] : []),
              ...(matchedIds.length > 0 ? [{ id: { in: matchedIds } }] : []),
            ],
          },
          include: {
            vehicleType: { select: { name: true } },
            parkingSpot: {
              select: {
                spotNumber: true,
                zone: { select: { name: true } },
              },
            },
            vehicle: {
              select: {
                customer: { select: { fullName: true, phone: true } },
              },
            },
          },
          orderBy: { entryTime: 'desc' },
          take: 200,
        });

    return {
      licensePlate: normalizedPlate,
      total: records.length,
      currentlyParked: records.filter((r) => r.status === 'parked').length,
      completed: records.filter((r) => r.status === 'completed').length,
      exceptionCount: records.filter((r) => (r.notes || '').includes('[NGOAI_LE:')).length,
      records,
    };
  }

  /**
   * Tra cứu thông minh theo biển số: trả về thông tin xe/khách hàng (nếu có)
   * kèm "insights" — tần suất ghé, chỗ đỗ ưa thích, gói dịch vụ, gợi ý chỗ đỗ.
   * Dùng cho auto-fill lúc nhân viên nhập biển số ở màn hình Xe vào.
   */
  async smartLookup(licensePlate: string) {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    if (!normalizedPlate) {
      throw { status: 400, message: 'Vui lòng nhập biển số hợp lệ' };
    }

    const vehicle = await this.findVehicleByNormalizedPlate(normalizedPlate);
    if (!vehicle) {
      return { vehicle: null, customer: null, insights: null };
    }

    const fullVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicle.id },
      include: {
        customer: true,
        vehicleType: { select: { id: true, name: true } },
      },
    });
    if (!fullVehicle) {
      return { vehicle: null, customer: null, insights: null };
    }

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const now = new Date();

    const [visitCount30Days, recentRecords, activePkg, allSpots] = await Promise.all([
      prisma.parkingRecord.count({ where: { vehicleId: fullVehicle.id, entryTime: { gte: since30 } } }),
      prisma.parkingRecord.findMany({
        where: { vehicleId: fullVehicle.id, status: 'completed' },
        orderBy: { entryTime: 'desc' },
        take: 30,
        include: { parkingSpot: { include: { zone: { select: { name: true } } } } },
      }),
      prisma.customerPackage.findFirst({
        where: {
          vehicleId: fullVehicle.id,
          status: { not: 'cancelled' },
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: { parkingPackage: { select: { name: true } } },
        orderBy: { endDate: 'asc' },
      }),
      // Lấy TOÀN BỘ chỗ đỗ (không lọc theo trạng thái) vì thuật toán SAW cần tổng số chỗ của
      // mỗi khu làm mẫu số để tính tỷ lệ còn trống (C2) và mức độ đông đúc (C5). Chỗ trống được
      // lọc ra từ mảng này ngay bên dưới, nên không phát sinh thêm query.
      prisma.parkingSpot.findMany({
        include: { zone: { select: { name: true, description: true } } },
        orderBy: [{ zoneId: 'asc' }, { spotNumber: 'asc' }],
      }),
    ]);
    const availableSpots = allSpots.filter((s) => s.status === 'available');

    const lastVisitRecord = await prisma.parkingRecord.findFirst({
      where: { vehicleId: fullVehicle.id },
      orderBy: { entryTime: 'desc' },
      select: { entryTime: true },
    });

    // Thời gian gửi trung bình (giờ), làm tròn 1 chữ số thập phân. Lọc bỏ bản ghi thiếu `duration`
    // để một dòng dữ liệu lỗi không kéo trung bình về NaN.
    const durations = recentRecords
      .map((r) => r.duration)
      .filter((d): d is number => typeof d === 'number');
    const avgDurationHours = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / 60) * 10) / 10
      : null;

    // Chấm điểm và xếp hạng các chỗ đỗ trống bằng SAW (Simple Additive Weighting) — thuật toán
    // ra quyết định đa tiêu chí, xem utils/smartParkingAlgorithms.ts và tài liệu thiết kế
    // docs/DE_XUAT_THUAT_TOAN_GOI_Y_CHO_DO_THONG_MINH.md.
    const { weights, alpha } = await this.getSawConfig();

    // Tiêu chí C1 — mức ưa thích chỗ đỗ, có trọng số suy giảm theo thời gian (Exponential
    // Decay) nên lượt đỗ gần đây ảnh hưởng mạnh hơn lượt cũ.
    //
    // Chấm ở HAI mức rồi cộng lại: điểm của khu + điểm của đúng chỗ đó. Bốn tiêu chí còn lại
    // đều là thuộc tính của khu, nên trong cùng một khu chúng bằng nhau ở mọi chỗ — nếu C1 cũng
    // chỉ ở mức khu thì các chỗ cùng khu bằng điểm nhau và thuật toán không phân biệt được
    // (xem phần giải thích ở calcSpotPreference).
    const zonePreferences = calcZonePreference(recentRecords, alpha);
    const spotPreferences = calcSpotPreference(recentRecords, alpha);
    let preferredZone: string | null = null;
    let maxPreference = 0;
    for (const [zone, score] of zonePreferences) {
      if (score > maxPreference) {
        maxPreference = score;
        preferredZone = zone;
      }
    }

    const zoneStats = calcZoneStats(allSpots);
    const hourlyPattern = calcHourlyPattern(recentRecords, now.getHours());

    const compatibleSpots = availableSpots.filter((s) =>
      isSpotCompatibleWithVehicleType(s, fullVehicle.vehicleType.name)
    );

    const candidates: SpotCandidate[] = compatibleSpots.map((spot) => {
      const zoneName = spot.zone?.name || '';
      const stats = zoneStats.get(zoneName);
      return {
        spotId: spot.id,
        spotNumber: spot.spotNumber,
        zoneName,
        zonePreference: (zonePreferences.get(zoneName) || 0) + (spotPreferences.get(spot.id) || 0),
        zoneAvailability: stats?.availability ?? 0,
        typeMatchScore: calcTypeMatch(spot, fullVehicle.vehicleType.name),
        // Khu chưa từng xuất hiện trong lịch sử của xe này thì không có căn cứ để nói hợp hay
        // không hợp khung giờ — cho điểm trung tính 0.5 thay vì 0 để không phạt oan khu mới.
        peakHourFit: hourlyPattern.get(zoneName) ?? 0.5,
        currentOccupancy: stats?.occupancy ?? 0,
      };
    });

    const sawResults = scoreSAW(candidates, weights);
    const bestSpot = sawResults[0] ?? null;

    let suggestedSpotId: number | null = null;
    let suggestedSpotLabel: string | null = null;
    let suggestedSpotNote: string | null = null;
    if (bestSpot) {
      suggestedSpotId = bestSpot.spotId;
      suggestedSpotLabel = `${bestSpot.zoneName} — ${bestSpot.spotNumber}`;
      suggestedSpotNote = bestSpot.explanation;
      // Khu quen hết chỗ thì nói rõ ra, để nhân viên giải thích được với khách vì sao đổi khu.
      if (preferredZone && bestSpot.zoneName !== preferredZone) {
        const preferredStillFree = compatibleSpots.some((s) => s.zone?.name === preferredZone);
        if (!preferredStillFree) {
          suggestedSpotNote = `${preferredZone} đã hết chỗ phù hợp — ${bestSpot.explanation}`;
        }
      }
    }

    return {
      vehicle: fullVehicle,
      customer: fullVehicle.customer,
      insights: {
        visitCount30Days,
        lastVisit: lastVisitRecord?.entryTime ?? null,
        avgDurationHours,
        preferredZone,
        hasActivePackage: !!activePkg,
        packageName: activePkg?.parkingPackage.name ?? null,
        packageExpiry: activePkg?.endDate ?? null,
        isFrequent: visitCount30Days >= 10,
        suggestedSpotId,
        suggestedSpotLabel,
        suggestedSpotNote,
        // Phần "giải thích được" (explainability) của thuật toán: nêu rõ đang dùng thuật toán
        // nào, trọng số bao nhiêu, và 3 chỗ đỗ đứng đầu bảng xếp hạng cùng điểm số.
        scoringDetails: {
          algorithm: 'SAW — Simple Additive Weighting',
          references: [
            'Fishburn, P.C. (1967). Operations Research, 15(3), 537–542',
            'Hwang, C.L. & Yoon, K. (1981). Multiple Attribute Decision Making. Springer-Verlag',
          ],
          weights: {
            zonePreference: weights[0],
            zoneAvailability: weights[1],
            typeMatch: weights[2],
            peakHourFit: weights[3],
            occupancy: weights[4],
          },
          decayAlpha: alpha,
          candidateCount: sawResults.length,
          topCandidates: sawResults.slice(0, 3).map((r) => ({
            spotId: r.spotId,
            spotNumber: r.spotNumber,
            zone: r.zoneName,
            score: Math.round(r.totalScore * 1000) / 1000,
            explanation: r.explanation,
          })),
        },
      },
    };
  }

  /**
   * Đọc tham số thuật toán SAW từ hệ chuyên gia (domain `parking_recommendation`), để admin
   * chỉnh trọng số trên giao diện mà không phải sửa code.
   *
   * Luật hỏng/thiếu/bị tắt thì rơi về bộ mặc định — gợi ý chỗ đỗ là chức năng chạy mỗi lần
   * nhân viên nhập biển số, không được phép chết vì một dòng cấu hình sai.
   */
  private async getSawConfig(): Promise<{ weights: number[]; alpha: number }> {
    const fallback = { weights: DEFAULT_SAW_WEIGHTS, alpha: DEFAULT_DECAY_ALPHA };
    try {
      const rules = await knowledgeBase.getRulesByDomain('parking_recommendation');
      const params = rules.find((r) => r.code === 'PARKING_REC_WEIGHTS')?.actions[0]?.params;
      if (!params) return fallback;

      const weights = SAW_WEIGHT_KEYS.map((key) => params[key]);
      if (weights.some((w) => typeof w !== 'number' || Number.isNaN(w))) return fallback;

      const alpha = params.decayAlpha;
      return {
        weights: weights as number[],
        alpha: typeof alpha === 'number' && alpha > 0 && alpha < 1 ? alpha : DEFAULT_DECAY_ALPHA,
      };
    } catch {
      return fallback;
    }
  }
}

export const parkingService = new ParkingService();
