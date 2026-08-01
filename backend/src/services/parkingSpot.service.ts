import prisma from '../config/prisma';
import { CreateParkingSpotInput, UpdateParkingSpotInput } from '../validators/parkingSpot.validator';

export class ParkingSpotService {
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
