/**
 * Nghiệp vụ quản lý phương tiện (xe của khách).
 *
 * Vị trí trong luồng:
 *   pages/Vehicles.tsx -> /api/vehicles -> vehicle.controller -> file này -> bảng Vehicles
 *
 * Mỗi phương tiện thuộc về một khách hàng và một loại xe. Loại xe quyết định BẢNG GIÁ áp dụng,
 * nên các thao tác đổi loại xe bị chặn khi xe đang trong bãi hoặc đang có gói còn hiệu lực.
 *
 * Biển số luôn được chuẩn hoá trước khi lưu và trước khi so sánh (utils/businessRules.ts).
 */
import prisma from '../config/prisma';
import { CreateVehicleInput, UpdateVehicleInput } from '../validators/vehicle.validator';
import { areLicensePlatesEqual, normalizeLicensePlate } from '../utils/businessRules';

export class VehicleService {
  /**
   * Tìm xe theo biển số, bỏ qua khác biệt về dấu gạch / khoảng trắng / chữ hoa thường.
   * (Cùng cách làm với parking.service.ts — xem ghi chú về hạn chế hiệu năng ở đó.)
   */
  private async findVehicleByNormalizedPlate(licensePlate: string) {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    const vehicles = await prisma.vehicle.findMany({
      include: {
        customer: { select: { fullName: true } },
        vehicleType: { select: { name: true } },
      },
    });

    return vehicles.find((vehicle) => areLicensePlatesEqual(vehicle.licensePlate, normalizedPlate)) ?? null;
  }

  /**
   * Danh sách phương tiện, kèm trạng thái ĐANG TRONG BÃI hay đã ra ngoài.
   * Dùng cho màn hình Phương tiện (pages/Vehicles.tsx).
   */
  async findAll(params: {
    search?: string;
    customerId?: number;
    vehicleTypeId?: number;
    parkingStatus?: 'parked' | 'outside';
  }) {
    const { search, customerId, vehicleTypeId, parkingStatus } = params;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        ...(search && {
          OR: [
            { licensePlate: { contains: search } },
            { customer: { fullName: { contains: search } } },
            { brand: { contains: search } },
            { model: { contains: search } },
          ],
        }),
        ...(customerId && { customerId }),
        ...(vehicleTypeId && { vehicleTypeId }),
        ...(parkingStatus === 'parked'
          ? { parkingRecords: { some: { status: 'parked' } } }
          : {}),
        ...(parkingStatus === 'outside'
          ? { parkingRecords: { none: { status: 'parked' } } }
          : {}),
      },
      include: {
        customer: { select: { fullName: true } },
        vehicleType: { select: { name: true } },
        // Chỉ cần biết CÓ hay KHÔNG có lượt đang đỗ, nên `take: 1` và chỉ lấy cột id. Không lấy
        // toàn bộ lịch sử gửi xe của phương tiện — với xe đi thường xuyên có thể là hàng trăm dòng.
        parkingRecords: {
          where: { status: 'parked' },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Quy đổi mảng `parkingRecords` (rỗng hoặc có 1 phần tử) thành một cờ dễ đọc cho giao diện,
    // để phía frontend không phải tự suy luận từ độ dài mảng.
    return vehicles.map((vehicle) => ({
      ...vehicle,
      parkingStatus: vehicle.parkingRecords.length > 0 ? 'parked' : 'outside',
    }));
  }

  /** Tra một xe theo biển số — dùng khi nhân viên gõ biển số ở màn hình Xe vào. */
  async findByPlate(plate: string) {
    const vehicle = await this.findVehicleByNormalizedPlate(plate);

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy xe' };
    }

    return vehicle;
  }

  async findById(id: number) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        customer: { select: { fullName: true } },
        vehicleType: { select: { name: true } },
      },
    });

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy xe' };
    }

    return vehicle;
  }

  /**
   * Đăng ký phương tiện mới cho một khách hàng.
   *
   * Ba điều kiện phải đúng: biển số chưa tồn tại, khách hàng có thật và đang hoạt động, loại xe
   * có trong danh mục. Kiểm tra khoá ngoại ngay ở đây để trả về thông báo tiếng Việt dễ hiểu,
   * thay vì để cơ sở dữ liệu ném lỗi ràng buộc khó đọc.
   */
  async create(data: CreateVehicleInput) {
    const normalizedPlate = normalizeLicensePlate(data.licensePlate);
    const [existing, customer, vehicleType] = await Promise.all([
      this.findVehicleByNormalizedPlate(normalizedPlate),
      prisma.customer.findFirst({
        where: { id: data.customerId, isActive: true },
        select: { id: true },
      }),
      prisma.vehicleType.findUnique({
        where: { id: data.vehicleTypeId },
        select: { id: true },
      }),
    ]);

    if (existing) {
      throw { status: 400, message: 'Biển số xe đã tồn tại' };
    }

    if (!customer) {
      throw { status: 400, message: 'Khách hàng không tồn tại hoặc đã ngừng hoạt động' };
    }

    if (!vehicleType) {
      throw { status: 400, message: 'Loại xe không tồn tại' };
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: data.customerId,
        vehicleTypeId: data.vehicleTypeId,
        licensePlate: normalizedPlate,
        brand: data.brand ?? null,
        model: data.model ?? null,
        color: data.color ?? null,
      },
    });

    return { message: 'Thêm xe thành công', id: vehicle.id };
  }

  /**
   * Cập nhật phương tiện, có hai lớp KHOÁ theo trạng thái nghiệp vụ:
   *
   *   1. Xe đang trong bãi -> không cho đổi biển số, chủ xe hay loại xe. Lý do: lượt gửi đang mở
   *      đã chốt giá theo loại xe cũ, đổi giữa chừng sẽ khiến lúc tính tiền không còn khớp với
   *      thông tin lúc xe vào.
   *   2. Xe đang có gói còn hiệu lực (hoặc chờ áp dụng) -> không cho đổi loại xe, vì giá gói được
   *      tính theo loại xe tại thời điểm mua.
   *
   * Vẫn cho sửa các thông tin không ảnh hưởng nghiệp vụ (hãng, dòng, màu) trong mọi trường hợp.
   */
  async update(id: number, data: UpdateVehicleInput) {
    const normalizedPlate = normalizeLicensePlate(data.licensePlate);
    const [vehicle, duplicateVehicle, customer, vehicleType, activeRecord, activeOrPendingPackage] = await Promise.all([
      prisma.vehicle.findUnique({
        where: { id },
        select: { id: true, customerId: true, vehicleTypeId: true, licensePlate: true },
      }),
      this.findVehicleByNormalizedPlate(normalizedPlate),
      prisma.customer.findFirst({
        where: { id: data.customerId, isActive: true },
        select: { id: true },
      }),
      prisma.vehicleType.findUnique({
        where: { id: data.vehicleTypeId },
        select: { id: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { vehicleId: id, status: 'parked' },
        select: { id: true },
      }),
      prisma.customerPackage.findFirst({
        where: {
          vehicleId: id,
          status: { in: ['active', 'pending'] },
        },
        select: { id: true },
      }),
    ]);

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy xe' };
    }

    // Loại trừ chính xe đang sửa: giữ nguyên biển số cũ thì không tính là trùng.
    if (duplicateVehicle && duplicateVehicle.id !== id) {
      throw { status: 400, message: 'Biển số xe đã tồn tại' };
    }

    if (!customer) {
      throw { status: 400, message: 'Khách hàng không tồn tại hoặc đã ngừng hoạt động' };
    }

    if (!vehicleType) {
      throw { status: 400, message: 'Loại xe không tồn tại' };
    }

    if (
      activeRecord &&
      (
        vehicle.vehicleTypeId !== data.vehicleTypeId ||
        vehicle.customerId !== data.customerId ||
        !areLicensePlatesEqual(vehicle.licensePlate, normalizedPlate)
      )
    ) {
      throw { status: 400, message: 'Xe đang ở trong bãi, không thể đổi biển số, chủ xe hoặc loại xe lúc này' };
    }

    if (activeOrPendingPackage && vehicle.vehicleTypeId !== data.vehicleTypeId) {
      throw { status: 400, message: 'Xe đang có gói còn hiệu lực hoặc chưa tới ngày áp dụng, không thể đổi loại xe' };
    }

    await prisma.vehicle.update({
      where: { id },
      data: {
        customerId: data.customerId,
        vehicleTypeId: data.vehicleTypeId,
        licensePlate: normalizedPlate,
        brand: data.brand ?? null,
        model: data.model ?? null,
        color: data.color ?? null,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  /**
   * Xoá phương tiện — đây là xoá CỨNG, nên chỉ cho phép khi xe chưa phát sinh dữ liệu nào.
   *
   * Ba điều kiện chặn: xe đang trong bãi, xe đã từng gửi (có lịch sử), xe đã từng mua gói.
   * Còn một trong ba thì từ chối, vì xoá đi sẽ làm mất lịch sử doanh thu và hỏng liên kết dữ liệu.
   * Khác với khách hàng (xoá mềm), phương tiện "sạch" chưa dùng đến thì xoá hẳn cho gọn danh mục.
   */
  async delete(id: number) {
    const [vehicle, parkedRecord, packageUsage, historyUsage] = await Promise.all([
      prisma.vehicle.findUnique({
        where: { id },
        select: { id: true, licensePlate: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { vehicleId: id, status: 'parked' },
        select: { id: true },
      }),
      prisma.customerPackage.findFirst({
        where: { vehicleId: id },
        select: { id: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { vehicleId: id },
        select: { id: true },
      }),
    ]);

    if (!vehicle) {
      throw { status: 404, message: 'Không tìm thấy xe' };
    }

    if (parkedRecord) {
      throw { status: 400, message: 'Xe đang ở trong bãi, không thể xóa' };
    }

    if (packageUsage || historyUsage) {
      throw { status: 400, message: 'Xe đã phát sinh lịch sử gửi xe hoặc gói dịch vụ, không thể xóa cứng' };
    }

    await prisma.vehicle.delete({ where: { id } });
    return { message: 'Xóa xe thành công' };
  }
}

export const vehicleService = new VehicleService();
