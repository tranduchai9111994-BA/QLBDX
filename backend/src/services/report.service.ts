import prisma from '../config/prisma';
import { alertSettingsService } from './alertSettings.service';
import { alertRuleTierService } from './alertRuleTier.service';
import { formatDateTimeVN, formatDateVN } from '../utils/formatDate';

export class ReportService {
  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [currentlyParked, spots, todayEntries, todayRevenue, monthRevenue] = await Promise.all([
      prisma.parkingRecord.count({ where: { status: 'parked' } }),
      prisma.parkingSpot.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.parkingRecord.count({
        where: {
          entryTime: { gte: today, lt: tomorrow },
        },
      }),
      prisma.payment.aggregate({
        where: {
          paidAt: { gte: today, lt: tomorrow },
          status: 'completed',
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          paidAt: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          status: 'completed',
        },
        _sum: { amount: true },
      }),
    ]);

    const totalSpots = spots.reduce((sum, s) => sum + s._count.id, 0);
    const availableSpots = spots.find((s) => s.status === 'available')?._count.id || 0;
    const occupiedSpots = spots.find((s) => s.status === 'occupied')?._count.id || 0;

    return {
      currentlyParked,
      totalSpots,
      availableSpots,
      occupiedSpots,
      todayEntries,
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      monthRevenue: Number(monthRevenue._sum.amount || 0),
    };
  }

  async getRevenue(from?: string, to?: string, groupBy?: string) {
    const where: any = { status: 'completed' };
    if (from) where.paidAt = { ...where.paidAt, gte: new Date(from) };
    if (to) where.paidAt = { ...where.paidAt, lte: new Date(to + 'T23:59:59.999') };

    // Prisma doesn't support date formatting in groupBy easily,
    // so we use raw query for this complex aggregation
    const payments = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        paymentType: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    const grouped = new Map<string, {
      totalRevenue: number;
      totalTransactions: number;
      parkingRevenue: number;
      packageRevenue: number;
    }>();

    for (const payment of payments) {
      let period: string;
      const date = new Date(payment.paidAt);

      switch (groupBy) {
        case 'month':
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          period = `${date.getFullYear()}`;
          break;
        default:
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      const existing = grouped.get(period) || {
        totalRevenue: 0,
        totalTransactions: 0,
        parkingRevenue: 0,
        packageRevenue: 0,
      };

      const amount = Number(payment.amount);
      existing.totalRevenue += amount;
      existing.totalTransactions += 1;
      if (payment.paymentType === 'parking') {
        existing.parkingRevenue += amount;
      } else {
        existing.packageRevenue += amount;
      }

      grouped.set(period, existing);
    }

    return Array.from(grouped.entries()).map(([period, data]) => ({
      period,
      ...data,
    }));
  }

  async getVehicleStats(from?: string, to?: string) {
    const where: any = { status: 'completed' };
    if (from) where.entryTime = { ...where.entryTime, gte: new Date(from) };
    if (to) where.entryTime = { ...where.entryTime, lte: new Date(to + 'T23:59:59.999') };
    if (!from && !to) {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      const firstDayOfNextMonth = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth() + 1, 1);
      where.entryTime = { gte: firstDayOfMonth, lt: firstDayOfNextMonth };
    }

    const records = await prisma.parkingRecord.findMany({
      where,
      include: {
        vehicleType: { select: { name: true } },
      },
    });

    const stats = new Map<string, { totalRecords: number; totalFees: number }>();
    for (const record of records) {
      const typeName = record.vehicleType.name;
      const existing = stats.get(typeName) || { totalRecords: 0, totalFees: 0 };
      existing.totalRecords += 1;
      existing.totalFees += Number(record.fee || 0);
      stats.set(typeName, existing);
    }

    return Array.from(stats.entries())
      .map(([vehicleType, data]) => ({ vehicleType, ...data }))
      .sort((a, b) => b.totalRecords - a.totalRecords);
  }

  async getHourlyStats(from?: string, to?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const rangeStart = from ? new Date(from) : today;
    const rangeEnd = to ? new Date(to + 'T23:59:59.999') : tomorrow;

    const records = await prisma.parkingRecord.findMany({
      where: {
        entryTime: { gte: rangeStart, lte: rangeEnd },
      },
      select: { entryTime: true },
    });

    const hourlyMap = new Map<number, number>();
    for (const record of records) {
      const hour = new Date(record.entryTime).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }

    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyMap.get(hour) || 0,
    }));
  }

  async getPaymentMethodStats(from?: string, to?: string) {
    const where: any = { status: 'completed' };
    if (from) where.paidAt = { ...where.paidAt, gte: new Date(from) };
    if (to) where.paidAt = { ...where.paidAt, lte: new Date(to + 'T23:59:59.999') };

    const payments = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        paymentMethod: true,
        paymentType: true,
      },
    });

    const methodMap = new Map<string, { totalAmount: number; totalTransactions: number }>();
    const typeMap = new Map<string, { totalAmount: number; totalTransactions: number }>();

    for (const payment of payments) {
      const method = payment.paymentMethod || 'unknown';
      const type = payment.paymentType || 'unknown';
      const amount = Number(payment.amount);

      const methodStat = methodMap.get(method) || { totalAmount: 0, totalTransactions: 0 };
      methodStat.totalAmount += amount;
      methodStat.totalTransactions += 1;
      methodMap.set(method, methodStat);

      const typeStat = typeMap.get(type) || { totalAmount: 0, totalTransactions: 0 };
      typeStat.totalAmount += amount;
      typeStat.totalTransactions += 1;
      typeMap.set(type, typeStat);
    }

    const methodLabel: Record<string, string> = {
      cash: 'Tiền mặt',
      card: 'Thẻ',
      transfer: 'Chuyển khoản',
      unknown: 'Khác',
    };
    const typeLabel: Record<string, string> = {
      parking: 'Gửi lẻ',
      package: 'Gói dịch vụ',
      unknown: 'Khác',
    };

    return {
      byMethod: Array.from(methodMap.entries())
        .map(([method, data]) => ({
          method,
          label: methodLabel[method] || method,
          ...data,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount),
      byType: Array.from(typeMap.entries())
        .map(([type, data]) => ({
          type,
          label: typeLabel[type] || type,
          ...data,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount),
      totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      totalTransactions: payments.length,
    };
  }

  async getExceptionStats(from?: string, to?: string) {
    // Exceptions được lưu trong notes với pattern [NGOAI_LE:reason]
    const where: any = { status: 'completed' };
    if (from) where.exitTime = { ...where.exitTime, gte: new Date(from) };
    if (to) where.exitTime = { ...where.exitTime, lte: new Date(to + 'T23:59:59.999') };

    const records = await prisma.parkingRecord.findMany({
      where: {
        ...where,
        notes: { contains: '[NGOAI_LE:' },
      },
      select: {
        id: true,
        licensePlate: true,
        entryTime: true,
        exitTime: true,
        fee: true,
        notes: true,
        vehicleType: { select: { name: true } },
        creator: { select: { fullName: true } },
      },
      orderBy: { exitTime: 'desc' },
    });

    const REASON_LABEL: Record<string, string> = {
      lost_ticket:    'Mất vé / mất phiếu',
      damaged_ticket: 'Vé hỏng / không quét được',
      force_release:  'Giải phóng chỗ bắt buộc',
      fee_waiver:     'Miễn giảm phí (ngoại lệ)',
      other:          'Lý do khác',
    };

    // Parse reason từ notes
    const parseReason = (notes: string | null): string => {
      if (!notes) return 'other';
      const match = notes.match(/\[NGOAI_LE:([^\]]+)\]/);
      return match ? match[1] : 'other';
    };

    const parsed = records.map((r) => {
      const reasonKey = parseReason(r.notes);
      return {
        id: r.id,
        licensePlate: r.licensePlate,
        vehicleType: r.vehicleType.name,
        entryTime: r.entryTime,
        exitTime: r.exitTime,
        fee: Number(r.fee || 0),
        reasonKey,
        reasonLabel: REASON_LABEL[reasonKey] || reasonKey,
        staffName: r.creator?.fullName || '-',
        notes: r.notes || '',
      };
    });

    // Group by reason
    const byReason = new Map<string, { label: string; count: number; totalFeeWaived: number }>();
    for (const rec of parsed) {
      const existing = byReason.get(rec.reasonKey) || { label: rec.reasonLabel, count: 0, totalFeeWaived: 0 };
      existing.count += 1;
      existing.totalFeeWaived += rec.fee;
      byReason.set(rec.reasonKey, existing);
    }

    const totalCount = parsed.length;
    const totalFeeImpact = parsed.reduce((s, r) => s + r.fee, 0);
    const waivedCount = parsed.filter((r) => r.reasonKey === 'fee_waiver').length;

    return {
      totalCount,
      totalFeeImpact,
      waivedCount,
      byReason: Array.from(byReason.entries())
        .map(([key, data]) => ({ key, ...data }))
        .sort((a, b) => b.count - a.count),
      records: parsed,
    };
  }

  async getAlerts(longParkingHoursOverride?: number) {
    const settings = await alertSettingsService.get();
    const tiers = await alertRuleTierService.getAllGrouped();
    const evalTier = (ruleType: Parameters<typeof alertRuleTierService.evaluate>[0], value: number) =>
      alertRuleTierService.evaluate(ruleType, value, tiers);

    // Ngưỡng thấp nhất của "Xe đỗ quá lâu" quyết định câu query DB (lấy candidate) — nếu admin
    // chưa cấu hình mốc nào, coi như tắt tính năng này (không query, không báo).
    const longParkingTierThresholds = (tiers.longParkingHours || []).map((t) => t.threshold);
    const longParkingHours = longParkingHoursOverride ?? (longParkingTierThresholds.length ? Math.min(...longParkingTierThresholds) : null);

    const suspiciousPaymentTierThresholds = (tiers.suspiciousPaymentAmount || []).map((t) => t.threshold);
    const suspiciousPaymentGate = suspiciousPaymentTierThresholds.length ? Math.min(...suspiciousPaymentTierThresholds) : null;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const longParkingThreshold = longParkingHours != null ? new Date(now.getTime() - longParkingHours * 60 * 60 * 1000) : null;
    const since30 = new Date(now);
    since30.setDate(since30.getDate() - 30);
    const yesterdayStart = new Date(today);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdaySameTime = new Date(now);
    yesterdaySameTime.setDate(yesterdaySameTime.getDate() - 1);

    const [
      expiringPackages,
      inconsistentPackages,
      zones,
      longParkedRecords,
      inconsistentOccupiedSpots,
      suspiciousPayments,
      vehicleTypeAvgDuration,
      currentlyParkedForAnomaly,
      todayRevenueAgg,
      yesterdayRevenueAgg,
    ] = await Promise.all([
      prisma.customerPackage.findMany({
        where: {
          status: 'active',
          endDate: { gte: today, lte: next7Days },
        },
        include: {
          customer: { select: { fullName: true } },
          vehicle: { select: { licensePlate: true } },
          parkingPackage: { select: { name: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 12,
      }),
      prisma.customerPackage.findMany({
        where: {
          status: 'active',
          OR: [
            { endDate: { lt: today } },
            { startDate: { gt: today } },
          ],
        },
        include: {
          customer: { select: { fullName: true } },
          vehicle: { select: { licensePlate: true } },
          parkingPackage: { select: { name: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 12,
      }),
      prisma.parkingZone.findMany({
        include: {
          parkingSpots: { select: { status: true } },
        },
        orderBy: { id: 'asc' },
      }),
      longParkingThreshold
        ? prisma.parkingRecord.findMany({
            where: {
              status: 'parked',
              entryTime: { lte: longParkingThreshold },
            },
            include: {
              vehicle: { select: { customer: { select: { fullName: true } } } },
              parkingSpot: {
                select: {
                  spotNumber: true,
                  zone: { select: { name: true } },
                },
              },
              vehicleType: { select: { name: true } },
            },
            orderBy: { entryTime: 'asc' },
            take: 20,
          })
        : Promise.resolve([]),
      prisma.parkingSpot.findMany({
        where: {
          status: 'occupied',
          parkingRecords: {
            none: { status: 'parked' },
          },
        },
        include: {
          zone: { select: { name: true } },
        },
        orderBy: [{ zoneId: 'asc' }, { spotNumber: 'asc' }],
        take: 20,
      }),
      prisma.payment.findMany({
        where: {
          OR: [
            { amount: { lte: 0 } },
            ...(suspiciousPaymentGate != null ? [{ amount: { gte: suspiciousPaymentGate } }] : []),
            {
              paymentType: 'parking',
              amount: { gte: Number(settings.suspiciousPaymentParkingAmount) },
            },
          ],
        },
        include: {
          parkingRecord: { select: { licensePlate: true } },
          customerPackage: {
            select: {
              vehicle: { select: { licensePlate: true } },
            },
          },
          creator: { select: { fullName: true } },
        },
        orderBy: { paidAt: 'desc' },
        take: 20,
      }),
      prisma.parkingRecord.groupBy({
        by: ['vehicleTypeId'],
        where: { status: 'completed', exitTime: { gte: since30 } },
        _avg: { duration: true },
      }),
      prisma.parkingRecord.findMany({
        where: { status: 'parked' },
        include: {
          vehicleType: { select: { name: true } },
        },
      }),
      prisma.payment.aggregate({
        where: { status: 'completed', paidAt: { gte: today, lte: now } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'completed', paidAt: { gte: yesterdayStart, lte: yesterdaySameTime } },
        _sum: { amount: true },
      }),
    ]);

    // --- Cảnh báo thông minh nâng cao (rule-based) ---

    // 1) Xe đỗ bất thường: duration hiện tại > 3 lần trung bình 30 ngày của loại xe đó
    const avgDurationByType = new Map(
      vehicleTypeAvgDuration.map((v) => [v.vehicleTypeId, Number(v._avg.duration || 0)])
    );
    const parkingAnomalyAlerts = currentlyParkedForAnomaly
      .map((record) => {
        const currentMinutes = Math.ceil((now.getTime() - new Date(record.entryTime).getTime()) / 60000);
        const avgMinutes = avgDurationByType.get(record.vehicleTypeId) || 0;
        if (avgMinutes <= 0 || currentMinutes < settings.parkingAnomalyMinMinutes) return null;
        const multiplier = currentMinutes / avgMinutes;
        const severity = evalTier('parkingAnomalyMultiplier', multiplier);
        if (!severity) return null;
        const currentHours = (currentMinutes / 60).toFixed(1);
        const avgHours = (avgMinutes / 60).toFixed(1);
        return {
          id: `parking-anomaly-${record.id}`,
          severity,
          category: 'parking',
          title: 'Xe đỗ bất thường',
          description: `${record.licensePlate} (${record.vehicleType.name}) đã đỗ ${currentHours}h, gấp ${multiplier.toFixed(1)} lần trung bình ${avgHours}h của loại xe này. Cần kiểm tra.`,
          occurredAt: record.entryTime,
          relatedPath: '/parking/history',
          smartLevel: 'rule_based',
          context: { avgDurationHours: Number(avgHours), currentDurationHours: Number(currentHours) },
          suggestedAction: 'Kiểm tra xe',
        };
      })
      .filter(Boolean);

    // 2) Biến động doanh thu: hôm nay (tính đến giờ hiện tại) so với cùng thời điểm hôm qua
    const todayRevenue = Number(todayRevenueAgg._sum.amount || 0);
    const yesterdayRevenue = Number(yesterdayRevenueAgg._sum.amount || 0);
    const revenueChangeAlerts: any[] = [];
    if (yesterdayRevenue > 0) {
      const changePercent = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
      const dropSeverity = changePercent < 0 ? evalTier('revenueDropPercent', Math.abs(changePercent)) : null;
      if (dropSeverity) {
        revenueChangeAlerts.push({
          id: 'revenue-change-today',
          severity: dropSeverity,
          category: 'revenue',
          title: 'Biến động doanh thu',
          description: `Doanh thu hôm nay (tính đến ${formatDateTimeVN(now)}) là ${todayRevenue.toLocaleString('vi-VN')}đ, thấp hơn ${Math.abs(Math.round(changePercent))}% so với cùng thời điểm hôm qua (${yesterdayRevenue.toLocaleString('vi-VN')}đ).`,
          occurredAt: now,
          relatedPath: '/reports',
          smartLevel: 'rule_based',
          context: { todayRevenue, yesterdayRevenue, changePercent: Math.round(changePercent) },
          suggestedAction: 'Xem báo cáo doanh thu',
        });
      }
    }

    // 3) Cơ hội gia hạn: gói sắp hết hạn + khách đỗ xe thường xuyên (>=5 lần/tháng)
    const expiringVehicleIds = expiringPackages.map((p) => p.vehicleId);
    const freqGroups = expiringVehicleIds.length
      ? await prisma.parkingRecord.groupBy({
          by: ['vehicleId'],
          where: { vehicleId: { in: expiringVehicleIds }, entryTime: { gte: since30 } },
          _count: { id: true },
        })
      : [];
    const freqByVehicleId = new Map(freqGroups.map((g) => [g.vehicleId, g._count.id]));
    const renewalOpportunityAlerts = expiringPackages
      .map((pkg) => {
        const frequency = freqByVehicleId.get(pkg.vehicleId) || 0;
        const severity = evalTier('renewalFrequency', frequency);
        if (!severity) return null;
        const daysLeft = Math.ceil((new Date(pkg.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: `renewal-opportunity-${pkg.id}`,
          severity,
          category: 'package',
          title: 'Cơ hội gia hạn',
          description: `${pkg.customer?.fullName || 'Khách hàng'} có gói sắp hết (còn ${daysLeft} ngày), tần suất đỗ ${frequency} lần/tháng — nên liên hệ gia hạn.`,
          occurredAt: pkg.endDate,
          relatedPath: '/customer-packages',
          smartLevel: 'rule_based',
          context: { frequency, daysLeft },
          suggestedAction: 'Liên hệ khách',
        };
      })
      .filter(Boolean);

    // 4) Mất cân bằng khu vực: 1 khu >90% trong khi khu khác <30%
    const zoneStats = zones
      .map((z) => {
        const total = z.parkingSpots.length;
        const available = z.parkingSpots.filter((s) => s.status === 'available').length;
        return { name: z.name, occupancyRate: total > 0 ? (total - available) / total : 0, total };
      })
      .filter((z) => z.total > 0);
    const zoneImbalanceAlerts: any[] = [];
    if (zoneStats.length >= 2) {
      const maxZone = zoneStats.reduce((a, b) => (b.occupancyRate > a.occupancyRate ? b : a));
      const minZone = zoneStats.reduce((a, b) => (b.occupancyRate < a.occupancyRate ? b : a));
      const imbalanceSeverity = maxZone.name !== minZone.name && minZone.occupancyRate < settings.zoneImbalanceMinPercent / 100
        ? evalTier('zoneImbalanceMaxPercent', maxZone.occupancyRate * 100)
        : null;
      if (imbalanceSeverity) {
        zoneImbalanceAlerts.push({
          id: 'zone-imbalance',
          severity: imbalanceSeverity,
          category: 'parking',
          title: 'Mất cân bằng khu vực',
          description: `${maxZone.name} quá tải (${Math.round(maxZone.occupancyRate * 100)}%), ${minZone.name} còn trống nhiều (${Math.round(minZone.occupancyRate * 100)}% đã dùng). Cân nhắc điều phối.`,
          occurredAt: now,
          relatedPath: '/parking-spots',
          smartLevel: 'rule_based',
          context: {
            maxZone: maxZone.name,
            maxOccupancy: Math.round(maxZone.occupancyRate * 100),
            minZone: minZone.name,
            minOccupancy: Math.round(minZone.occupancyRate * 100),
          },
          suggestedAction: 'Điều phối khu vực',
        });
      }
    }

    // Mốc "lỏng nhất" (ít nghiêm trọng nhất còn cấu hình) — dùng làm mức độ dự phòng khi 1 tình
    // huống được phát hiện qua ngưỡng phụ (VD: số chỗ trống tuyệt đối) chứ không qua % chính.
    const zoneNearFullTiers = tiers.zoneNearFullPercent || [];
    const loosestZoneNearFullSeverity = zoneNearFullTiers.length
      ? zoneNearFullTiers.reduce((a, b) => (b.threshold > a.threshold ? b : a)).severity
      : null;
    const suspiciousPaymentTiers = tiers.suspiciousPaymentAmount || [];
    const loosestSuspiciousPaymentSeverity = suspiciousPaymentTiers.length
      ? suspiciousPaymentTiers.reduce((a, b) => (b.threshold < a.threshold ? b : a)).severity
      : null;

    const alerts = [
      ...expiringPackages.map((pkg) => ({
        id: `package-expiring-${pkg.id}`,
        severity: 'warning',
        category: 'package',
        title: 'Gói sắp hết hạn',
        description: `${pkg.vehicle?.licensePlate || 'Không rõ biển số'} • ${pkg.customer?.fullName || 'Khách hàng'} • ${pkg.parkingPackage?.name || 'Gói dịch vụ'} hết hạn ngày ${formatDateVN(pkg.endDate)}.`,
        occurredAt: pkg.endDate,
        relatedPath: '/customer-packages',
      })),
      ...inconsistentPackages.map((pkg) => ({
        id: `package-inconsistent-${pkg.id}`,
        severity: 'danger',
        category: 'package',
        title: 'Gói active bị lệch trạng thái',
        description: `${pkg.vehicle?.licensePlate || 'Không rõ biển số'} vẫn đang lưu trạng thái active nhưng mốc hiệu lực không còn đúng.`,
        occurredAt: pkg.endDate,
        relatedPath: '/customer-packages',
      })),
      ...zones
        .map((zone) => {
          const total = zone.parkingSpots.length;
          const available = zone.parkingSpots.filter((spot) => spot.status === 'available').length;
          if (total === 0) return null;
          if (available === 0) {
            return {
              id: `zone-full-${zone.id}`,
              severity: settings.zoneFullSeverity,
              category: 'parking',
              title: 'Khu vực đã đầy',
              description: `${zone.name} hiện không còn chỗ trống (${total}/${total} chỗ đang sử dụng hoặc bảo trì).`,
              occurredAt: now,
              relatedPath: '/parking-spots',
            };
          }
          const nearFullPercent = (available / total) * 100;
          let nearFullSeverity = evalTier('zoneNearFullPercent', nearFullPercent);
          if (!nearFullSeverity && available <= settings.zoneNearFullAvailable) {
            nearFullSeverity = loosestZoneNearFullSeverity;
          }
          if (nearFullSeverity) {
            return {
              id: `zone-near-full-${zone.id}`,
              severity: nearFullSeverity,
              category: 'parking',
              title: 'Khu vực sắp đầy',
              description: `${zone.name} chỉ còn ${available}/${total} chỗ trống.`,
              occurredAt: now,
              relatedPath: '/parking-spots',
            };
          }
          return null;
        })
        .filter(Boolean),
      ...longParkedRecords.map((record) => {
        const hoursParked = (now.getTime() - new Date(record.entryTime).getTime()) / 3600000;
        const severity = evalTier('longParkingHours', hoursParked);
        if (!severity) return null;
        return {
          id: `parking-long-${record.id}`,
          severity,
          category: 'parking',
          title: 'Xe đỗ quá lâu',
          description: `${record.licensePlate} (${record.vehicleType.name}) đã ở trong bãi từ ${formatDateTimeVN(record.entryTime)} tại ${record.parkingSpot?.zone?.name || 'khu chưa rõ'} - ${record.parkingSpot?.spotNumber || 'chưa gán chỗ'}.`,
          occurredAt: record.entryTime,
          relatedPath: '/parking/history',
        };
      }),
      ...inconsistentOccupiedSpots.map((spot) => ({
        id: `spot-inconsistent-${spot.id}`,
        severity: 'danger',
        category: 'parking',
        title: 'Chỗ đỗ occupied bị lệch dữ liệu',
        description: `${spot.zone?.name || 'Khu chưa rõ'} - ${spot.spotNumber} đang là occupied nhưng không có lượt xe active.`,
        occurredAt: now,
        relatedPath: '/parking-spots',
      })),
      ...suspiciousPayments.map((payment) => {
        const amount = Number(payment.amount);
        let severity: string | null;
        if (amount <= 0) {
          severity = 'danger';
        } else {
          severity = evalTier('suspiciousPaymentAmount', amount);
          if (!severity && payment.paymentType === 'parking' && amount >= Number(settings.suspiciousPaymentParkingAmount)) {
            severity = loosestSuspiciousPaymentSeverity;
          }
        }
        if (!severity) return null;
        return {
          id: `payment-suspicious-${payment.id}`,
          severity,
          category: 'payment',
          title: 'Thanh toán bất thường',
          description: `Giao dịch #${payment.id} có số tiền ${amount.toLocaleString('vi-VN')}đ cho xe ${payment.parkingRecord?.licensePlate || payment.customerPackage?.vehicle?.licensePlate || 'không rõ'} .`,
          occurredAt: payment.paidAt,
          relatedPath: '/payments',
        };
      }),
      ...parkingAnomalyAlerts,
      ...revenueChangeAlerts,
      ...renewalOpportunityAlerts,
      ...zoneImbalanceAlerts,
    ]
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const severityOrder = { danger: 0, warning: 1, info: 2 };
        const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
        if (severityDiff !== 0) return severityDiff;
        return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      });

    return alerts;
  }

  /**
   * Dashboard thông minh (DSS): so sánh tuần này vs tuần trước, giờ cao điểm,
   * xu hướng 7 ngày, loại xe phổ biến nhất, và gợi ý hành động rule-based.
   */
  async getInsights() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=CN..6=T7
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - daysSinceMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekSameTime = new Date(now);
    lastWeekSameTime.setDate(lastWeekSameTime.getDate() - 7);

    const since30 = new Date(now);
    since30.setDate(since30.getDate() - 30);
    const last7DaysStart = new Date(now);
    last7DaysStart.setDate(last7DaysStart.getDate() - 6);
    last7DaysStart.setHours(0, 0, 0, 0);

    const [
      thisWeekRecords,
      lastWeekRecords,
      thisWeekRevenueAgg,
      lastWeekRevenueAgg,
      recentRecords30d,
      zones,
      longParkedCount,
      expiringPackagesCount,
    ] = await Promise.all([
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: thisWeekStart, lte: now } },
        select: { duration: true },
      }),
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: lastWeekStart, lte: lastWeekSameTime } },
        select: { duration: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'completed', paidAt: { gte: thisWeekStart, lte: now } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'completed', paidAt: { gte: lastWeekStart, lte: lastWeekSameTime } },
        _sum: { amount: true },
      }),
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: since30 } },
        select: { entryTime: true, vehicleTypeId: true, vehicleType: { select: { name: true } } },
      }),
      prisma.parkingZone.findMany({ include: { parkingSpots: { select: { status: true } } } }),
      prisma.parkingRecord.count({
        where: { status: 'parked', entryTime: { lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.customerPackage.count({
        where: {
          status: 'active',
          endDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const avgDurationHours = (records: { duration: number | null }[]) => {
      const durations = records.map((r) => r.duration).filter((d): d is number => typeof d === 'number');
      if (durations.length === 0) return 0;
      return Math.round((durations.reduce((a, b) => a + b, 0) / durations.length / 60) * 10) / 10;
    };

    const thisWeekRevenue = Number(thisWeekRevenueAgg._sum.amount || 0);
    const lastWeekRevenue = Number(lastWeekRevenueAgg._sum.amount || 0);
    const thisWeekVehicles = thisWeekRecords.length;
    const lastWeekVehicles = lastWeekRecords.length;
    const thisWeekAvgDuration = avgDurationHours(thisWeekRecords);
    const lastWeekAvgDuration = avgDurationHours(lastWeekRecords);

    const pctChange = (curr: number, prev: number) => (prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0);

    const weekComparison = {
      thisWeek: { revenue: thisWeekRevenue, vehicles: thisWeekVehicles, avgDuration: thisWeekAvgDuration },
      lastWeek: { revenue: lastWeekRevenue, vehicles: lastWeekVehicles, avgDuration: lastWeekAvgDuration },
      changePercent: {
        revenue: pctChange(thisWeekRevenue, lastWeekRevenue),
        vehicles: pctChange(thisWeekVehicles, lastWeekVehicles),
        avgDuration: pctChange(thisWeekAvgDuration, lastWeekAvgDuration),
      },
    };

    // Giờ cao điểm (30 ngày gần nhất): tách buổi sáng (5-11h) và buổi chiều (12-21h)
    const hourCounts = new Map<number, number>();
    for (const r of recentRecords30d) {
      const hour = new Date(r.entryTime).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
    const daysSpan = 30;
    const bestHourIn = (range: number[]) => {
      let bestHour = range[0];
      let bestCount = -1;
      for (const h of range) {
        const c = hourCounts.get(h) || 0;
        if (c > bestCount) {
          bestCount = c;
          bestHour = h;
        }
      }
      return { hour: bestHour, avgCount: Math.round((bestCount / daysSpan) * 10) / 10 };
    };
    const morningRange = Array.from({ length: 7 }, (_, i) => i + 5); // 5..11
    const afternoonRange = Array.from({ length: 10 }, (_, i) => i + 12); // 12..21
    const peakHours = {
      morning: bestHourIn(morningRange),
      afternoon: bestHourIn(afternoonRange),
    };

    // Xu hướng 7 ngày gần nhất
    const dailyTrend: { date: string; vehicles: number; revenue: number }[] = [];
    const dailyPayments = await prisma.payment.findMany({
      where: { status: 'completed', paidAt: { gte: last7DaysStart, lte: now } },
      select: { amount: true, paidAt: true },
    });
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(last7DaysStart);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const vehicles = recentRecords30d.filter((r) => {
        const t = new Date(r.entryTime).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      }).length;
      const revenue = dailyPayments
        .filter((p) => {
          const t = new Date(p.paidAt).getTime();
          return t >= dayStart.getTime() && t <= dayEnd.getTime();
        })
        .reduce((sum, p) => sum + Number(p.amount), 0);
      dailyTrend.push({ date: dayStart.toISOString().slice(0, 10), vehicles, revenue });
    }

    // Top loại xe phổ biến nhất (30 ngày)
    const typeCounts = new Map<string, number>();
    for (const r of recentRecords30d) {
      const name = r.vehicleType.name;
      typeCounts.set(name, (typeCounts.get(name) || 0) + 1);
    }
    const totalTyped = recentRecords30d.length || 1;
    const topVehicleTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count, percent: Math.round((count / totalTyped) * 1000) / 10 }))
      .sort((a, b) => b.count - a.count);

    // Gợi ý cho admin (rule-based)
    const suggestions: { type: string; message: string }[] = [];
    if (weekComparison.changePercent.revenue > 10) {
      suggestions.push({
        type: 'revenue_up',
        message: `Doanh thu tuần này tăng ${weekComparison.changePercent.revenue}% so với tuần trước. Giờ cao điểm chiều (${peakHours.afternoon.hour}h) đông nhất — cân nhắc bố trí thêm nhân viên.`,
      });
    } else if (weekComparison.changePercent.revenue < -10) {
      suggestions.push({
        type: 'revenue_down',
        message: `Doanh thu tuần này giảm ${Math.abs(weekComparison.changePercent.revenue)}% so với tuần trước, cần xem xét nguyên nhân (lượng xe, giá, cạnh tranh...).`,
      });
    }

    const zoneStats = zones
      .map((z) => {
        const total = z.parkingSpots.length;
        const available = z.parkingSpots.filter((s) => s.status === 'available').length;
        return { name: z.name, occupancyRate: total > 0 ? (total - available) / total : 0, total };
      })
      .filter((z) => z.total > 0);
    for (const z of zoneStats) {
      if (z.occupancyRate > 0.8) {
        suggestions.push({
          type: 'occupancy_warning',
          message: `${z.name} đạt ${Math.round(z.occupancyRate * 100)}% công suất. Nên cân nhắc điều phối xe sang khu khác còn trống.`,
        });
      }
    }

    if (longParkedCount > 5) {
      suggestions.push({
        type: 'long_parking',
        message: `Có ${longParkedCount} xe đỗ quá 24 giờ, cần kiểm tra và xử lý.`,
      });
    }

    if (expiringPackagesCount > 10) {
      suggestions.push({
        type: 'renewal_campaign',
        message: `${expiringPackagesCount} khách hàng sắp hết gói trong 7 ngày tới — cơ hội triển khai chiến dịch gia hạn.`,
      });
    }

    return { weekComparison, peakHours, dailyTrend, topVehicleTypes, suggestions };
  }
}

export const reportService = new ReportService();
