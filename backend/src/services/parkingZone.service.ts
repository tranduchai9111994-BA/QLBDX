import prisma from '../config/prisma';
import { CreateParkingZoneInput, UpdateParkingZoneInput } from '../validators/parkingZone.validator';

export class ParkingZoneService {
  async findAll() {
    const zones = await prisma.parkingZone.findMany({
      include: {
        _count: {
          select: { parkingSpots: true },
        },
        parkingSpots: {
          select: { status: true },
        },
      },
      orderBy: { id: 'asc' },
    });

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
