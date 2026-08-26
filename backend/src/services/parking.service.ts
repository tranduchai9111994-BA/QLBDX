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

const EXCEPTION_REASON_LABEL: Record<string, string> = {
  lost_ticket: 'Mất vé / mất phiếu',
  damaged_ticket: 'Vé hỏng / không quét được',
  force_release: 'Giải phóng chỗ bắt buộc',
  fee_waiver: 'Miễn giảm phí (ngoại lệ)',
  other: 'Lý do khác',
};

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
    const record = await prisma.parkingRecord.findFirst({
      where: { id: params.recordId, status: 'parked' },
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

    let hasPackage = false;
    if (record.vehicleId) {
      hasPackage = await this.hasActivePackage(record.vehicleId);
    }

    const calc = calculateParkingFee(
      durationMs,
      {
        hourlyRate: Number(record.vehicleType.hourlyRate),
        dailyRate: Number(record.vehicleType.dailyRate),
      },
      { hasPackage }
    );

    let fee = calc.fee;
    if (params.waiveFee || params.exceptionReason === 'fee_waiver') {
      fee = 0;
    } else if (typeof params.feeOverride === 'number' && Number.isFinite(params.feeOverride)) {
      fee = Math.max(0, params.feeOverride);
    }

    const mergedNotes = [record.notes, params.notesAppend].filter(Boolean).join('\n').slice(0, 500);

    await prisma.parkingRecord.update({
      where: { id: params.recordId },
      data: {
        exitTime,
        duration: calc.durationMinutes,
        fee: new Decimal(fee),
        status: 'completed',
        ...(mergedNotes ? { notes: mergedNotes } : {}),
      },
    });

    if (record.parkingSpotId) {
      await prisma.parkingSpot.update({
        where: { id: record.parkingSpotId },
        data: { status: 'available' },
      });
    }

    if (fee > 0) {
      await prisma.payment.create({
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
            customer: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { entryTime: 'desc' },
    });
  }

  async entry(data: ParkingEntryInput, createdByUserId: number) {
    const normalizedPlate = normalizeLicensePlate(data.licensePlate);

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

    await prisma.parkingSpot.update({
      where: { id: data.parkingSpotId },
      data: { status: 'occupied' },
    });

    return { message: 'Ghi nhận xe vào thành công', id: record.id };
  }

  async exit(data: ParkingExitInput, createdByUserId: number) {
    return this.completeExit({
      recordId: data.parkingRecordId,
      createdByUserId,
      paymentMethod: data.paymentMethod || 'cash',
    });
  }

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
        hourlyRate: Number(record.vehicleType.hourlyRate),
        dailyRate: Number(record.vehicleType.dailyRate),
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

  async history(params: {
    from?: string;
    to?: string;
    licensePlate?: string;
    zoneId?: number;
    vehicleTypeId?: number;
    search?: string;
  }) {
    const { from, to, licensePlate, zoneId, vehicleTypeId, search } = params;
    const normalizedPlate = licensePlate ? normalizeLicensePlate(licensePlate) : '';

    return prisma.parkingRecord.findMany({
      where: {
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

  async plateHistory(licensePlate: string) {
    const normalizedPlate = normalizeLicensePlate(licensePlate);
    if (!normalizedPlate) {
      throw { status: 400, message: 'Vui lòng nhập biển số hợp lệ' };
    }

    const records = await prisma.parkingRecord.findMany({
      where: {
        OR: [
          { licensePlate: { contains: normalizedPlate } },
          { licensePlate: { contains: licensePlate.trim() } },
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
      take: 100,
    });

    const filtered = records.filter((record) => {
      const plate = normalizeLicensePlate(record.licensePlate);
      return (
        areLicensePlatesEqual(record.licensePlate, normalizedPlate)
        || plate.includes(normalizedPlate)
        || record.licensePlate.includes(licensePlate.trim())
      );
    });

    return {
      licensePlate: normalizedPlate,
      total: filtered.length,
      currentlyParked: filtered.filter((r) => r.status === 'parked').length,
      completed: filtered.filter((r) => r.status === 'completed').length,
      exceptionCount: filtered.filter((r) => (r.notes || '').includes('[NGOAI_LE:')).length,
      records: filtered,
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

    const [visitCount30Days, recentRecords, activePkg, availableSpots] = await Promise.all([
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
      prisma.parkingSpot.findMany({
        where: { status: 'available' },
        include: { zone: { select: { name: true, description: true } } },
        orderBy: [{ zoneId: 'asc' }, { spotNumber: 'asc' }],
      }),
    ]);

    const lastVisitRecord = await prisma.parkingRecord.findFirst({
      where: { vehicleId: fullVehicle.id },
      orderBy: { entryTime: 'desc' },
      select: { entryTime: true },
    });

    const durations = recentRecords
      .map((r) => r.duration)
      .filter((d): d is number => typeof d === 'number');
    const avgDurationHours = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / 60) * 10) / 10
      : null;

    const zoneCounts = new Map<string, number>();
    for (const r of recentRecords) {
      const zoneName = r.parkingSpot?.zone?.name;
      if (zoneName) zoneCounts.set(zoneName, (zoneCounts.get(zoneName) || 0) + 1);
    }
    let preferredZone: string | null = null;
    let maxCount = 0;
    for (const [zone, count] of zoneCounts) {
      if (count > maxCount) {
        maxCount = count;
        preferredZone = zone;
      }
    }

    const compatibleSpots = availableSpots.filter((s) =>
      isSpotCompatibleWithVehicleType(s, fullVehicle.vehicleType.name)
    );
    let suggestedSpotId: number | null = null;
    let suggestedSpotLabel: string | null = null;
    let suggestedSpotNote: string | null = null;
    if (compatibleSpots.length > 0) {
      const inPreferred = preferredZone
        ? compatibleSpots.filter((s) => s.zone?.name === preferredZone)
        : [];
      const chosen = inPreferred[0] || compatibleSpots[0];
      suggestedSpotId = chosen.id;
      suggestedSpotLabel = `${chosen.zone?.name} — ${chosen.spotNumber}`;
      if (preferredZone && inPreferred.length === 0) {
        suggestedSpotNote = `${preferredZone} đã hết chỗ phù hợp, gợi ý ${chosen.zone?.name} thay thế`;
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
      },
    };
  }
}

export const parkingService = new ParkingService();
