/**
 * Nghiệp vụ GÓI DỊCH VỤ CỦA KHÁCH (khách đã mua gói nào, hiệu lực từ ngày nào tới ngày nào).
 *
 * Phân biệt hai khái niệm dễ nhầm:
 *   - ParkingPackage  (package.service.ts)      = gói trong DANH MỤC, ví dụ "Gói tháng xe máy".
 *   - CustomerPackage (file này)                = một lần khách MUA gói đó, có thời hạn cụ thể.
 *
 * Vị trí trong luồng:
 *   pages/CustomerPackages.tsx -> /api/customer-packages -> file này
 *   Khi xe vào/ra, parking.service.ts tra bảng này để biết lượt gửi có được miễn phí không.
 *
 * Hàm đáng chú ý nhất: `getPackageRecommendation` — dùng HỆ CHUYÊN GIA để gợi ý khách nên mua
 * gói nào dựa trên tần suất gửi xe thực tế.
 */
import prisma from '../config/prisma';
import { CreateCustomerPackageInput } from '../validators/customerPackage.validator';
import { getPackageLifecycleStatus } from '../utils/businessRules';
import { syncDuePackagePrices } from './pricing.service';
import { evaluate } from '../expertSystem';

export class CustomerPackageService {
  /**
   * Đánh dấu 'expired' cho các gói đã qua ngày kết thúc.
   *
   * Vì sao cần: cột `status` trong DB không tự đổi theo thời gian. Nếu chỉ tính trạng thái lúc
   * hiển thị thì các truy vấn lọc theo `status` (báo cáo, thống kê) vẫn thấy gói cũ là 'active'.
   * Hàm này được gọi ở đầu các thao tác đọc/ghi quan trọng, thay cho việc phải cài một tác vụ
   * chạy nền hằng đêm.
   */
  private async syncExpiredStatuses(now = new Date()) {
    await prisma.customerPackage.updateMany({
      where: {
        status: { in: ['active', 'pending'] },
        endDate: { lt: now },
      },
      data: { status: 'expired' },
    });
  }

  /** Trạng thái thật tại thời điểm hiện tại (xem getPackageLifecycleStatus ở utils/businessRules.ts). */
  private getRuntimeStatus(pkg: { status: string; startDate: Date; endDate: Date }, now = new Date()) {
    return getPackageLifecycleStatus(pkg.status, pkg.startDate, pkg.endDate, now);
  }

  /**
   * Kiểm tra toàn bộ điều kiện trước khi bán một gói cho khách. Gom vào một chỗ để hàm `create`
   * đọc gọn và để không bỏ sót điều kiện nào.
   *
   * Bảy điều kiện, theo thứ tự kiểm tra:
   *   1. Khách hàng tồn tại và đang hoạt động.
   *   2. Phương tiện tồn tại.
   *   3. Phương tiện đúng là của khách hàng đó (không bán gói cho xe người khác).
   *   4. Gói dịch vụ tồn tại và còn áp dụng.
   *   5. Đang trong thời gian mở bán của gói (validFrom / validTo).
   *   6. Loại xe của phương tiện khớp với loại xe của gói (giá gói tính theo loại xe).
   *   7. Xe chưa có gói nào trùng khoảng thời gian — chống mua chồng gói.
   */
  private async ensurePackageCreateValidity(data: CreateCustomerPackageInput, startDate: Date, endDate: Date) {
    const [customer, vehicle, pkg, overlappingPackage] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: data.customerId, isActive: true },
        select: { id: true },
      }),
      prisma.vehicle.findUnique({
        where: { id: data.vehicleId },
        select: { id: true, customerId: true, vehicleTypeId: true, licensePlate: true },
      }),
      prisma.parkingPackage.findUnique({
        where: { id: data.packageId },
      }),
      // Phát hiện gói trùng khoảng thời gian. Điều kiện giao nhau của hai đoạn [A1,A2] và [B1,B2]
      // là: A1 <= B2 VÀ A2 >= B1 — nên chỉ cần hai phép so sánh, không phải liệt kê các trường hợp.
      // Gói đã huỷ không tính vào đây, khách được mua lại cho đúng khoảng thời gian đó.
      prisma.customerPackage.findFirst({
        where: {
          vehicleId: data.vehicleId,
          status: { not: 'cancelled' },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      }),
    ]);

    if (!customer) {
      throw { status: 400, message: 'Khách hàng không tồn tại hoặc đã ngừng hoạt động' };
    }

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy phương tiện' };
    }

    if (vehicle.customerId !== data.customerId) {
      throw { status: 400, message: 'Phương tiện không thuộc khách hàng đã chọn' };
    }

    if (!pkg) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ' };
    }

    if (!pkg.isActive) {
      throw { status: 400, message: 'Gói dịch vụ này đã ngừng áp dụng' };
    }

    // Ngoài khoảng thời gian bán (nếu gói có đặt validFrom/validTo) -> chặn ở backend, không chỉ ẩn
    // khỏi dropdown frontend, để không thể bỏ qua bằng cách gọi API trực tiếp.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pkg.validFrom && today < pkg.validFrom) {
      throw { status: 400, message: `Gói dịch vụ chưa mở bán (bắt đầu bán từ ${pkg.validFrom.toLocaleDateString('vi-VN')})` };
    }
    if (pkg.validTo && today > pkg.validTo) {
      throw { status: 400, message: `Gói dịch vụ đã hết thời gian bán (kết thúc bán ${pkg.validTo.toLocaleDateString('vi-VN')})` };
    }

    if (vehicle.vehicleTypeId !== pkg.vehicleTypeId) {
      throw { status: 400, message: 'Loại xe không khớp với gói dịch vụ đã chọn' };
    }

    if (overlappingPackage) {
      throw { status: 400, message: 'Xe đã có một gói trùng thời gian hiệu lực, không thể đăng ký chồng' };
    }

    return { vehicle, pkg };
  }

  async findAll(params: {
    customerId?: number;
    status?: string;
    search?: string;
    packageId?: number;
    vehicleTypeId?: number;
    fromDate?: string;
    toDate?: string;
  }) {
    await this.syncExpiredStatuses();
    const { customerId, status, search, packageId, vehicleTypeId, fromDate, toDate } = params;

    const packages = await prisma.customerPackage.findMany({
      where: {
        ...(customerId && { customerId }),
        ...(packageId && { packageId }),
        ...(vehicleTypeId
          ? {
              vehicle: { vehicleTypeId },
            }
          : {}),
        ...((fromDate || toDate)
          ? {
              startDate: {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999`) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { customer: { fullName: { contains: search } } },
                { customer: { phone: { contains: search } } },
                { vehicle: { licensePlate: { contains: search } } },
                { parkingPackage: { name: { contains: search } } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { fullName: true, phone: true } },
        parkingPackage: { select: { id: true, name: true, price: true, vehicleTypeId: true } },
        vehicle: { select: { licensePlate: true, vehicleTypeId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return packages
      .map((pkg) => ({
        ...pkg,
        status: this.getRuntimeStatus(pkg),
      }))
      .filter((pkg) => !status || pkg.status === status);
  }

  async create(data: CreateCustomerPackageInput, createdByUserId: number) {
    await this.syncExpiredStatuses();
    await syncDuePackagePrices();

    const startDate = new Date(data.startDate);
    startDate.setHours(0, 0, 0, 0);
    const { pkg } = await this.ensurePackageCreateValidity(data, startDate, startDate);

    // endDate: ưu tiên giá trị người dùng nhập, nếu bỏ trống thì tính từ durationDays của gói.
    let endDate: Date;
    if (data.endDate) {
      endDate = new Date(data.endDate);
      if (Number.isNaN(endDate.getTime())) {
        throw { status: 400, message: 'Ngày kết thúc không hợp lệ' };
      }
      endDate.setHours(23, 59, 59, 999);
      if (endDate <= startDate) {
        throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' };
      }
    } else {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + pkg.durationDays);
      endDate.setHours(23, 59, 59, 999);
    }

    await this.ensurePackageCreateValidity(data, startDate, endDate);
    const status = this.getRuntimeStatus({ status: 'active', startDate, endDate });

    const customerPackage = await prisma.customerPackage.create({
      data: {
        customerId: data.customerId,
        packageId: data.packageId,
        vehicleId: data.vehicleId,
        startDate,
        endDate,
        status,
      },
    });

    // Create payment record
    await prisma.payment.create({
      data: {
        customerPackageId: customerPackage.id,
        amount: pkg.price,
        paymentType: 'package',
        createdBy: createdByUserId,
      },
    });

    return { message: 'Đăng ký gói thành công', id: customerPackage.id };
  }

  async update(id: number, data: { customerId?: number; vehicleId?: number; status?: string; startDate?: string; endDate?: string }) {
    await this.syncExpiredStatuses();

    const currentPackage = await prisma.customerPackage.findUnique({
      where: { id },
      include: {
        parkingPackage: {
          select: { vehicleTypeId: true },
        },
      },
    });

    if (!currentPackage) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ khách hàng' };
    }

    const nextCustomerId = data.customerId ?? currentPackage.customerId;
    const nextVehicleId = data.vehicleId ?? currentPackage.vehicleId;
    const nextStatus = data.status ?? currentPackage.status;

    const [customer, vehicle] = await Promise.all([
      prisma.customer.findFirst({
        where: { id: nextCustomerId, isActive: true },
        select: { id: true },
      }),
      prisma.vehicle.findUnique({
        where: { id: nextVehicleId },
        select: { id: true, customerId: true, vehicleTypeId: true },
      }),
    ]);

    if (!customer) {
      throw { status: 400, message: 'Khách hàng không tồn tại hoặc đã ngừng hoạt động' };
    }

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy phương tiện' };
    }

    if (vehicle.customerId !== nextCustomerId) {
      throw { status: 400, message: 'Phương tiện không thuộc khách hàng đã chọn' };
    }

    if (vehicle.vehicleTypeId !== currentPackage.parkingPackage.vehicleTypeId) {
      throw { status: 400, message: 'Phương tiện không cùng loại với gói dịch vụ hiện tại' };
    }

    const runtimeStatus = this.getRuntimeStatus(currentPackage);
    if (runtimeStatus === 'active' && nextStatus === 'pending') {
      throw { status: 400, message: 'Gói đang có hiệu lực, không thể chuyển về trạng thái chờ áp dụng' };
    }

    let nextStartDate = currentPackage.startDate;
    let nextEndDate = currentPackage.endDate;
    if (data.startDate || data.endDate) {
      if (data.startDate) {
        nextStartDate = new Date(data.startDate);
        nextStartDate.setHours(0, 0, 0, 0);
      }
      if (data.endDate) {
        nextEndDate = new Date(data.endDate);
        nextEndDate.setHours(23, 59, 59, 999);
      }
      if (Number.isNaN(nextStartDate.getTime()) || Number.isNaN(nextEndDate.getTime())) {
        throw { status: 400, message: 'Ngày bắt đầu/kết thúc không hợp lệ' };
      }
      if (nextEndDate <= nextStartDate) {
        throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' };
      }

      const overlapping = await prisma.customerPackage.findFirst({
        where: {
          id: { not: id },
          vehicleId: nextVehicleId,
          status: { not: 'cancelled' },
          startDate: { lte: nextEndDate },
          endDate: { gte: nextStartDate },
        },
        select: { id: true },
      });
      if (overlapping) {
        throw { status: 400, message: 'Xe đã có một gói trùng thời gian hiệu lực, không thể sửa chồng lấn' };
      }
    }

    await prisma.customerPackage.update({
      where: { id },
      data: {
        customerId: nextCustomerId,
        vehicleId: nextVehicleId,
        status: nextStatus,
        startDate: nextStartDate,
        endDate: nextEndDate,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  async delete(id: number) {
    const customerPackage = await prisma.customerPackage.findUnique({
      where: { id },
      include: {
        payments: { select: { id: true } },
      },
    });

    if (!customerPackage) {
      throw { status: 404, message: 'Không tìm thấy gói dịch vụ khách hàng' };
    }

    const runtimeStatus = this.getRuntimeStatus(customerPackage);
    if (runtimeStatus === 'active' || runtimeStatus === 'pending') {
      throw { status: 400, message: 'Gói đang còn hiệu lực hoặc chưa tới ngày áp dụng, hãy chuyển sang hủy thay vì xóa' };
    }

    if (customerPackage.payments.length > 0) {
      throw { status: 400, message: 'Gói đã phát sinh thanh toán, không thể xóa cứng' };
    }

    await prisma.customerPackage.delete({
      where: { id },
    });

    return { message: 'Xóa gói dịch vụ thành công' };
  }

  async checkActivePackage(vehicleId: number) {
    await this.syncExpiredStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activePackage = await prisma.customerPackage.findFirst({
      where: {
        vehicleId,
        status: { not: 'cancelled' },
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        parkingPackage: { select: { name: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    const daysUntilExpiry = activePackage
      ? Math.ceil(
          (new Date(activePackage.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      hasPackage: !!activePackage,
      package: activePackage
        ? {
            ...activePackage,
            status: this.getRuntimeStatus(activePackage),
          }
        : null,
      daysUntilExpiry,
      isExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry <= 7,
    };
  }

  /**
   * Gợi ý gói dịch vụ theo tần suất đỗ xe 30 ngày gần nhất (rule-based).
   * Ngưỡng: >=20 lần/tháng → gói năm, >=12 → gói quý, >=5 → gói tháng, còn lại → không gợi ý.
   */
  /**
   * GỢI Ý GÓI DỊCH VỤ cho khách — nơi HỆ CHUYÊN GIA được áp dụng vào nghiệp vụ.
   *
   * Cách hoạt động:
   *   1. Đo DỮ KIỆN từ dữ liệu thật: số lần khách gửi xe trong 30 ngày gần nhất (`frequency`).
   *   2. Đưa dữ kiện vào máy suy diễn với nhóm luật 'package' — `evaluate({ frequency }, 'package')`.
   *   3. Luật nào thoả sẽ cho biết nên gợi ý mức gói nào (tháng / quý / năm) và mức tiết kiệm.
   *   4. Tra ra gói cụ thể trong danh mục khớp loại xe khách hay gửi và số ngày của mức gói đó.
   *
   * Điểm quan trọng: các ngưỡng "gửi bao nhiêu lần thì gợi ý gói nào" KHÔNG nằm trong mã nguồn
   * này. Chúng là dữ liệu trong bảng ExpertRules, người quản trị sửa được trên giao diện
   * (Cảnh báo -> Cấu hình nâng cao) mà không cần lập trình viên can thiệp.
   */
  async getPackageRecommendation(customerId: number) {
    await this.syncExpiredStatuses();
    await syncDuePackagePrices();

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, fullName: true },
    });
    if (!customer) {
      throw { status: 404, message: 'Không tìm thấy khách hàng' };
    }

    const now = new Date();
    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const [records, activePkg] = await Promise.all([
      prisma.parkingRecord.findMany({
        where: { vehicle: { customerId }, entryTime: { gte: since30 }, status: 'completed' },
        select: { fee: true, vehicleTypeId: true },
      }),
      prisma.customerPackage.findFirst({
        where: {
          customerId,
          status: { not: 'cancelled' },
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
    ]);

    const frequency = records.length;
    const totalSpent = records.reduce((sum, r) => sum + Number(r.fee || 0), 0);

    // Khách đang có gói thì không gợi ý mua thêm — tránh làm phiền và tránh bán chồng gói.
    if (activePkg) {
      return {
        recommendation: 'none' as const,
        savings: null,
        frequency,
        totalSpent,
        reason: 'Khách hàng đã có gói đang hiệu lực',
      };
    }

    // Gọi máy suy diễn. Ở đây chỉ truyền một dữ kiện là `frequency`; muốn thêm tiêu chí mới
    // (ví dụ tổng tiền đã chi) thì bổ sung vào object này rồi tạo luật dùng dữ kiện đó.
    const evalResult = await evaluate({ frequency }, 'package');
    // Lấy luật cháy ĐẦU TIÊN. Cơ sở tri thức đã sắp xếp theo priority tăng dần, mà priority nhỏ
    // hơn nghĩa là ưu tiên cao hơn — nên nếu khách vừa đủ điều kiện gói tháng, gói quý và gói năm
    // thì luật gói năm (priority nhỏ nhất) được chọn.
    const fired = evalResult.firedRules[0];

    if (!fired) {
      return {
        recommendation: 'none' as const,
        savings: null,
        frequency,
        totalSpent,
        reason: frequency === 0
          ? 'Chưa có dữ liệu đỗ xe trong 30 ngày qua'
          : `Tần suất đỗ xe thấp (${frequency} lần/tháng, dưới ngưỡng cấu hình)`,
      };
    }

    const params = fired.actionOutputs[0].params;
    const recommendation: 'yearly' | 'quarterly' | 'monthly' | 'none' = params.package;
    const savings: string | null = params.savings;
    const durationDays: number | null = params.durationDays;

    // Một khách có thể có nhiều xe khác loại. Chọn loại xe khách gửi NHIỀU NHẤT trong 30 ngày
    // để tra đúng gói — vì mỗi gói chỉ áp dụng cho một loại xe và giá khác nhau theo loại.
    const typeCounts = new Map<number, number>();
    for (const r of records) typeCounts.set(r.vehicleTypeId, (typeCounts.get(r.vehicleTypeId) || 0) + 1);
    let dominantTypeId = records[0].vehicleTypeId;
    let maxCount = 0;
    for (const [typeId, count] of typeCounts) {
      if (count > maxCount) {
        maxCount = count;
        dominantTypeId = typeId;
      }
    }

    const matchingPackage = await prisma.parkingPackage.findFirst({
      where: { vehicleTypeId: dominantTypeId, durationDays: durationDays!, isActive: true },
    });

    const reasonByLevel: Record<'yearly' | 'quarterly' | 'monthly' | 'none', string> = {
      yearly: `Đỗ xe ${frequency} lần/tháng — rất thường xuyên`,
      quarterly: `Đỗ xe ${frequency} lần/tháng — thường xuyên`,
      monthly: `Đỗ xe ${frequency} lần/tháng — khá đều đặn`,
      none: `Đỗ xe ${frequency} lần/tháng`,
    };

    return {
      recommendation,
      savings,
      frequency,
      totalSpent,
      reason: reasonByLevel[recommendation],
      // Trả kèm `explanation` do máy suy diễn sinh ra (ví dụ "frequency = 12 >= 5 -> đúng").
      // Đây là tính GIẢI THÍCH ĐƯỢC của hệ chuyên gia: nhân viên nói được với khách vì sao hệ
      // thống đề xuất gói này, thay vì đưa ra một con số không rõ nguồn gốc.
      explanation: fired.explanation,
      packageId: matchingPackage?.id ?? null,
      packageName: matchingPackage?.name ?? null,
      packagePrice: matchingPackage ? Number(matchingPackage.price) : null,
    };
  }
}

export const customerPackageService = new CustomerPackageService();
