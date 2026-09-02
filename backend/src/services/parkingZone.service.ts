/**
 * Nghiệp vụ quản lý KHU VỰC đỗ xe (Khu A, Khu B, Khu VIP...).
 *
 * Cấu trúc phân cấp của bãi: Khu vực (ParkingZone) -> nhiều Chỗ đỗ (ParkingSpot) -> mỗi lượt gửi
 * xe chiếm một chỗ đỗ.
 *
 * Lưu ý nghiệp vụ: tên khu vực còn được dùng để suy ra khu này dành cho loại xe nào
 * (xem getSpotCategory trong utils/businessRules.ts), nên đặt tên theo quy ước "Khu A - Xe máy"
 * sẽ giúp hệ thống gợi ý chỗ chính xác hơn.
 */
import prisma from '../config/prisma';
import { CreateParkingZoneInput, UpdateParkingZoneInput } from '../validators/parkingZone.validator';

export class ParkingZoneService {
  /**
   * Danh sách khu vực kèm số liệu sức chứa: tổng chỗ, còn trống, đang có xe.
   * Dùng cho sơ đồ bãi và các thẻ thống kê ở màn hình Tổng quan.
   */
  async findAll() {
    const zones = await prisma.parkingZone.findMany({
      include: {
        _count: {
          select: { parkingSpots: true },
        },
        // Chỉ lấy đúng cột `status` của các chỗ đỗ để đếm — không kéo toàn bộ thông tin chỗ đỗ
        // về ứng dụng, vì ở màn hình này chỉ cần con số tổng hợp.
        parkingSpots: {
          select: { status: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Chuyển dữ liệu thô của Prisma thành đúng hình dạng giao diện cần: gộp mảng trạng thái các
    // chỗ đỗ thành ba con số. Nhờ vậy frontend chỉ việc hiển thị, không phải tự đếm.
    return zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      description: zone.description,
      totalSpots: zone._count.parkingSpots,
      availableSpots: zone.parkingSpots.filter((s) => s.status === 'available').length,
      occupiedSpots: zone.parkingSpots.filter((s) => s.status === 'occupied').length,
      createdAt: zone.createdAt,
    }));
  }

  /** Thêm khu vực mới. Tên khu không được trùng vì đây là thứ người dùng nhìn để phân biệt. */
  async create(data: CreateParkingZoneInput) {
    const existingZone = await prisma.parkingZone.findFirst({
      where: { name: data.name },
      select: { id: true },
    });

    if (existingZone) {
      throw { status: 400, message: 'Tên khu vực đã tồn tại' };
    }

    const zone = await prisma.parkingZone.create({
      data: {
        name: data.name,
        description: data.description ?? null,
      },
    });

    return { message: 'Thêm khu vực thành công', id: zone.id };
  }

  /** Sửa khu vực. `NOT: { id }` để giữ nguyên tên cũ không bị báo trùng với chính nó. */
  async update(id: number, data: UpdateParkingZoneInput) {
    const [zone, duplicateZone] = await Promise.all([
      prisma.parkingZone.findUnique({
        where: { id },
        select: { id: true },
      }),
      prisma.parkingZone.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
        select: { id: true },
      }),
    ]);

    if (!zone) {
      throw { status: 404, message: 'Không tìm thấy khu vực' };
    }

    if (duplicateZone) {
      throw { status: 400, message: 'Tên khu vực đã tồn tại' };
    }

    await prisma.parkingZone.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  /**
   * Xoá khu vực — ba lớp chặn, xét từ nghiêm trọng nhất xuống:
   *   1. Đang có chỗ nào có xe -> xoá là mất dấu xe đang gửi.
   *   2. Đã phát sinh lịch sử gửi xe -> xoá là mất dữ liệu báo cáo/doanh thu.
   *   3. Vẫn còn chỗ đỗ trực thuộc -> yêu cầu dọn chỗ trước, tránh xoá dây chuyền ngoài ý muốn.
   */
  async delete(id: number) {
    const [zone, spotsInZone, occupiedSpot, historyUsage] = await Promise.all([
      prisma.parkingZone.findUnique({
        where: { id },
        select: { id: true },
      }),
      prisma.parkingSpot.count({
        where: { zoneId: id },
      }),
      prisma.parkingSpot.findFirst({
        where: { zoneId: id, status: 'occupied' },
        select: { id: true },
      }),
      prisma.parkingRecord.findFirst({
        where: {
          parkingSpot: { zoneId: id },
        },
        select: { id: true },
      }),
    ]);

    if (!zone) {
      throw { status: 404, message: 'Không tìm thấy khu vực' };
    }

    if (occupiedSpot) {
      throw { status: 400, message: 'Khu vực đang có chỗ đỗ được sử dụng, không thể xóa' };
    }

    if (historyUsage) {
      throw { status: 400, message: 'Khu vực đã phát sinh lịch sử gửi xe, không thể xóa cứng' };
    }

    if (spotsInZone > 0) {
      throw { status: 400, message: 'Khu vực vẫn còn chỗ đỗ, hãy xóa hoặc chuyển toàn bộ chỗ đỗ trước' };
    }

    await prisma.parkingZone.delete({
      where: { id },
    });

    return { message: 'Xóa khu vực thành công' };
  }
}

export const parkingZoneService = new ParkingZoneService();
