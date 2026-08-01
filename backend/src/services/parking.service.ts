import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../config/prisma';
import { ParkingEntryInput, ParkingExitInput } from '../validators/parking.validator';
import {
  areLicensePlatesEqual,
  isSpotCompatibleWithVehicleType,
  normalizeLicensePlate,
} from '../utils/businessRules';

export class ParkingService {
  private async findVehicleByNormalizedPlate(licensePlate: string) {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    const vehicles = await prisma.vehicle.findMany({
      include: {
        vehicleType: { select: { name: true } },
      },
    });

    return vehicles.find((vehicle) => areLicensePlatesEqual(vehicle.licensePlate, normalizedPlate)) ?? null;
  }

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

  async findAll(params: {
    status?: string;
    search?: string;
    zoneId?: number;
    vehicleTypeId?: number;
    from?: string;
    to?: string;
  }) {
    const { status, search, zoneId, vehicleTypeId, from, to } = params;
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
            customer: { select: { fullName: true } },
          },
        },
      },
      orderBy: { entryTime: 'desc' },
    });
  }

  async entry(data: ParkingEntryInput, createdByUserId: number) {
    const normalizedPlate = normalizeLicensePlate(data.licensePlate);

    // Check if vehicle is already parked
    const parkedRecords = await prisma.parkingRecord.findMany({
      where: { status: 'parked' },
      select: { id: true, licensePlate: true },
    });
    const alreadyParked = parkedRecords.find((record) => areLicensePlatesEqual(record.licensePlate, normalizedPlate));

    if (alreadyParked) {
      throw { status: 400, message: 'Xe này đang đỗ trong bãi' };
    }

    const [vehicle, requestedVehicleType, selectedSpot, availableSpots] = await Promise.all([
      this.findVehicleByNormalizedPlate(normalizedPlate),
      prisma.vehicleType.findUnique({
        where: { id: data.vehicleTypeId },
        select: { id: true, name: true },
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

    const effectiveVehicleTypeId = vehicle?.vehicleTypeId ?? data.vehicleTypeId;
    const effectiveVehicleTypeName = vehicle?.vehicleType.name ?? requestedVehicleType.name;
    const compatibleAvailableSpots = availableSpots.filter((spot) =>
      isSpotCompatibleWithVehicleType(spot, effectiveVehicleTypeName)
    );

    if (compatibleAvailableSpots.length === 0) {
      throw { status: 400, message: `Đã hết chỗ đỗ phù hợp cho loại xe ${effectiveVehicleTypeName}` };
    }

    if (!selectedSpot || selectedSpot.status !== 'available') {
      throw { status: 400, message: 'Chỗ đỗ đã được sử dụng hoặc không khả dụng' };
    }

    if (!isSpotCompatibleWithVehicleType(selectedSpot, effectiveVehicleTypeName)) {
      throw { status: 400, message: `Chỗ đỗ đã chọn không phù hợp với loại xe ${effectiveVehicleTypeName}` };
    }

    const record = await prisma.parkingRecord.create({
      data: {
        vehicleId: vehicle?.id ?? null,
        licensePlate: normalizedPlate,
        vehicleTypeId: effectiveVehicleTypeId,
        parkingSpotId: data.parkingSpotId,
        notes: data.notes ?? null,
        createdBy: createdByUserId,
      },
    });

    // Update parking spot status
    await prisma.parkingSpot.update({
      where: { id: data.parkingSpotId },
      data: { status: 'occupied' },
    });

    return { message: 'Ghi nhận xe vào thành công', id: record.id };
  }

  async exit(data: ParkingExitInput, createdByUserId: number) {
    const record = await prisma.parkingRecord.findFirst({
      where: { id: data.parkingRecordId, status: 'parked' },
      include: {
        vehicleType: { select: { hourlyRate: true, dailyRate: true } },
      },
    });

    if (!record) {
      throw { status: 404, message: 'Không tìm thấy bản ghi' };
    }

    const entryTime = new Date(record.entryTime);
    const exitTime = new Date();
    const durationMs = exitTime.getTime() - entryTime.getTime();
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

    // Check if vehicle has active package
    let fee = 0;
    let hasPackage = false;

    if (record.vehicleId) {
      hasPackage = await this.hasActivePackage(record.vehicleId);
    }

    if (!hasPackage) {
      const hourlyRate = Number(record.vehicleType.hourlyRate);
      const dailyRate = Number(record.vehicleType.dailyRate);

      if (durationHours <= 24) {
        fee = Math.min(durationHours * hourlyRate, dailyRate);
      } else {
        const days = Math.ceil(durationHours / 24);
        fee = days * dailyRate;
      }
    }

    // Update parking record
    await prisma.parkingRecord.update({
      where: { id: data.parkingRecordId },
      data: {
        exitTime,
        duration: durationMinutes,
        fee: new Decimal(fee),
        status: 'completed',
      },
    });

    // Free up parking spot
    if (record.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: record.parkingSpotId },
        data: { status: 'available' },
      });
    }

    // Create payment record
    if (fee > 0) {
      await prisma.payment.create({
        data: {
          parkingRecordId: data.parkingRecordId,
          amount: new Decimal(fee),
          paymentMethod: data.paymentMethod || 'cash',
          paymentType: 'parking',
          createdBy: createdByUserId,
        },
      });
    }

    return {
      message: 'Ghi nhận xe ra thành công',
      data: {
        entryTime,
        exitTime,
        durationMinutes,
        fee,
        hasPackage,
      },
    };
  }

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
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

    let fee = 0;
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

    if (!hasPackage) {
      const hourlyRate = Number(record.vehicleType.hourlyRate);
      const dailyRate = Number(record.vehicleType.dailyRate);
      if (durationHours <= 24) {
        fee = Math.min(durationHours * hourlyRate, dailyRate);
      } else {
        const days = Math.ceil(durationHours / 24);
        fee = days * dailyRate;
      }
    }

    return { fee, hasPackage, durationMinutes, packageEndDate, daysUntilExpiry };
  }

  async history(params: {
    from?: string;
    to?: string;
    licensePlate?: string;
    zoneId?: number;
    vehicleTypeId?: number;
    search?: string;
  }) {
    const { from, to, licensePlate, zoneId, vehicleTypeId, search } = params;
    return prisma.parkingRecord.findMany({
      where: {
        status: 'completed',
        ...((from || to)
          ? {
              entryTime: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
              },
            }
          : {}),
        ...(licensePlate && { licensePlate: { contains: licensePlate } }),
        ...(vehicleTypeId ? { vehicleTypeId } : {}),
        ...(zoneId ? { parkingSpot: { zoneId } } : {}),
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
            customer: { select: { fullName: true } },
          },
        },
      },
      orderBy: { exitTime: 'desc' },
    });
  }
}

export const parkingService = new ParkingService();
