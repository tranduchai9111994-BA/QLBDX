import prisma from '../config/prisma';
import { CreateVehicleTypeInput, UpdateVehicleTypeInput } from '../validators/vehicleType.validator';

export class VehicleTypeService {
  async findAll() {
    return prisma.vehicleType.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async create(data: CreateVehicleTypeInput) {
    const duplicateType = await prisma.vehicleType.findFirst({
      where: { name: data.name },
      select: { id: true },
    });

    if (duplicateType) {
      throw { status: 400, message: 'Tên loại xe đã tồn tại' };
    }

    const vehicleType = await prisma.vehicleType.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        hourlyRate: data.hourlyRate,
        dailyRate: data.dailyRate,
        monthlyRate: data.monthlyRate,
      },
    });

    return { message: 'Thêm loại xe thành công', id: vehicleType.id };
  }

  async update(id: number, data: UpdateVehicleTypeInput) {
    const [vehicleType, duplicateType, parkedUsage] = await Promise.all([
      prisma.vehicleType.findUnique({
        where: { id },
        select: { id: true, name: true },
      }),
      prisma.vehicleType.findFirst({
        where: {
          name: data.name,
          NOT: { id },
        },
        select: { id: true },
      }),
      prisma.parkingRecord.findFirst({
        where: { vehicleTypeId: id, status: 'parked' },
        select: { id: true },
      }),
    ]);

    if (!vehicleType) {
      throw { status: 404, message: 'Không tìm thấy loại xe' };
    }

    if (duplicateType) {
      throw { status: 400, message: 'Tên loại xe đã tồn tại' };
    }

    if (parkedUsage && vehicleType.name !== data.name) {
      throw { status: 400, message: 'Loại xe đang được dùng cho xe trong bãi, chưa nên đổi tên lúc này' };
    }

    await prisma.vehicleType.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description ?? null,
        hourlyRate: data.hourlyRate,
        dailyRate: data.dailyRate,
        monthlyRate: data.monthlyRate,
      },
    });

    return { message: 'Cập nhật thành công' };
  }

  async delete(id: number) {
    const vehicles = await prisma.vehicle.findMany({ where: { vehicleTypeId: id } });
    if (vehicles.length > 0) {
      throw { status: 400, message: `Không thể xóa vì đang có ${vehicles.length} xe thuộc loại này` };
    }

    const packages = await prisma.parkingPackage.findMany({ where: { vehicleTypeId: id } });
    if (packages.length > 0) {
      throw { status: 400, message: `Không thể xóa vì đang có ${packages.length} gói đỗ xe thuộc loại này` };
    }

    const historyUsage = await prisma.parkingRecord.findFirst({
      where: { vehicleTypeId: id },
      select: { id: true },
    });
    if (historyUsage) {
      throw { status: 400, message: 'Không thể xóa vì loại xe này đã phát sinh lịch sử gửi xe' };
    }

    await prisma.vehicleType.delete({ where: { id } });
    return { message: 'Xóa loại xe thành công' };
  }
}

export const vehicleTypeService = new VehicleTypeService();
