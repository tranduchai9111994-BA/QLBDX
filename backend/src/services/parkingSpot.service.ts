/**
 * Nghiệp vụ quản lý CHỖ ĐỖ — đơn vị nhỏ nhất của bãi xe, mỗi chỗ chứa một xe.
 *
 * Vị trí trong luồng: pages/ParkingSpots.tsx (sơ đồ bãi) -> /api/parking-spots -> file này.
 *
 * Trạng thái của chỗ đỗ được cập nhật TỰ ĐỘNG bởi luồng vận hành:
 *   xe vào  -> parking.service.entry()        đặt chỗ thành 'occupied'
 *   xe ra   -> parking.service.completeExit() trả chỗ về 'available'
 * Vì vậy hàm update() ở đây chặn việc sửa tay trạng thái, tránh làm lệch số liệu thực tế.
 */
import prisma from '../config/prisma';
import { CreateParkingSpotInput, UpdateParkingSpotInput } from '../validators/parkingSpot.validator';

export class ParkingSpotService {
  /** Danh sách chỗ đỗ, lọc theo khu vực và/hoặc trạng thái. Sắp xếp theo khu rồi tới số chỗ. */
  async findAll(zoneId?: number, status?: string) {
    return prisma.parkingSpot.findMany({
      where: {
        ...(zoneId && { zoneId }),
        ...(status && { status }),
      },
      include: {
        zone: { select: { name: true } },
      },
      orderBy: [{ zoneId: 'asc' }, { spotNumber: 'asc' }],
    });
  }

  /**
   * Thêm chỗ đỗ mới vào một khu vực.
   * Số chỗ chỉ cần duy nhất TRONG CÙNG MỘT KHU — khu A và khu B đều có thể có chỗ số "01".
   */
  async create(data: CreateParkingSpotInput) {
    const [zone, existingSpot] = await Promise.all([
      prisma.parkingZone.findUnique({
        where: { id: data.zoneId },
        select: { id: true },
      }),
      prisma.parkingSpot.findFirst({
        where: {
          zoneId: data.zoneId,
          spotNumber: data.spotNumber,
        },
        select: { id: true },
      }),
    ]);

    if (!zone) {
      throw { status: 400, message: 'Khu vực không tồn tại' };
    }

    if (existingSpot) {
      throw { status: 400, message: 'Số chỗ đỗ đã tồn tại trong khu vực này' };
    }

    const spot = await prisma.parkingSpot.create({
      data: {
        zoneId: data.zoneId,
        spotNumber: data.spotNumber,
        spotType: data.spotType ?? 'standard',
      },
    });

    return { message: 'Thêm chỗ đỗ thành công', id: spot.id };
  }

  /**
   * Sửa chỗ đỗ, đồng thời BẢO VỆ tính nhất quán của trạng thái.
   *
   * Trạng thái chỗ đỗ (available / occupied) phải luôn phản ánh đúng thực tế bãi xe, mà thực tế
   * đó do luồng xe vào / xe ra quyết định (parking.service.ts). Vì vậy chặn hai thao tác tay:
   *   - Chỗ ĐANG CÓ XE mà chuyển sang trạng thái khác 'occupied' -> chỗ sẽ bị coi là trống và
   *     xe thứ hai được xếp vào cùng một chỗ.
   *   - Chỗ TRỐNG mà tự đặt thành 'occupied' -> chỗ bị khoá vĩnh viễn, không lượt gửi nào giải
   *     phóng được vì không có bản ghi nào gắn với nó.
   * Vẫn cho sửa `spotType` bình thường trong mọi trường hợp.
   */
  async update(id: number, data: UpdateParkingSpotInput) {
    const [spot, activeRecord] = await Promise.all([
      prisma.parkingSpot.findUnique({
        where: { id },
        select: { id: true, status: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { parkingSpotId: id, status: 'parked' },
        select: { id: true },
      }),
    ]);

    if (!spot) {
      throw { status: 404, message: 'Không tìm thấy chỗ đỗ' };
    }

    if (activeRecord && data.status && data.status !== 'occupied') {
      throw { status: 400, message: 'Chỗ đỗ đang có xe, không thể chuyển sang trạng thái khác occupied' };
    }

    if (!activeRecord && data.status === 'occupied') {
      throw { status: 400, message: 'Không thể tự đặt chỗ đỗ thành occupied khi chưa có xe vào' };
    }

    await prisma.parkingSpot.update({
      where: { id },
      data: {
        spotType: data.spotType ?? 'standard',
        status: data.status ?? 'available',
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  /**
   * Xoá chỗ đỗ. Chặn khi đang có xe (mất dấu xe) hoặc khi đã từng có xe gửi (mất lịch sử).
   * Chỉ chỗ đỗ chưa dùng đến bao giờ mới xoá được — ví dụ vừa thêm nhầm số chỗ.
   */
  async delete(id: number) {
    const [spot, activeRecord, historyUsage] = await Promise.all([
      prisma.parkingSpot.findUnique({
        where: { id },
        select: { id: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { parkingSpotId: id, status: 'parked' },
        select: { id: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { parkingSpotId: id },
        select: { id: true },
      }),
    ]);

    if (!spot) {
      throw { status: 404, message: 'Không tìm thấy chỗ đỗ' };
    }

    if (activeRecord) {
      throw { status: 400, message: 'Chỗ đỗ đang có xe, không thể xóa' };
    }

    if (historyUsage) {
      throw { status: 400, message: 'Chỗ đỗ đã phát sinh lịch sử gửi xe, không thể xóa cứng' };
    }

    await prisma.parkingSpot.delete({
      where: { id },
    });

    return { message: 'Xóa chỗ đỗ thành công' };
  }
}

export const parkingSpotService = new ParkingSpotService();
