import prisma from '../config/prisma';
import { CreateVehicleInput, UpdateVehicleInput } from '../validators/vehicle.validator';
import { areLicensePlatesEqual, normalizeLicensePlate } from '../utils/businessRules';

export class VehicleService {
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

  async findAll(search?: string, customerId?: number) {
    return prisma.vehicle.findMany({
      where: {
        ...(search && {
          OR: [
            { licensePlate: { contains: search } },
            { customer: { fullName: { contains: search } } },
          ],
        }),
        ...(customerId && { customerId }),
      },
      include: {
        customer: { select: { fullName: true } },
        vehicleType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

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
