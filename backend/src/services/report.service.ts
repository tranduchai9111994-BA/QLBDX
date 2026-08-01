import prisma from '../config/prisma';

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

  async getHourlyStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const records = await prisma.parkingRecord.findMany({
      where: {
        entryTime: { gte: today, lt: tomorrow },
      },
      select: { entryTime: true },
    });

    const hourlyMap = new Map<number, number>();
    for (const record of records) {
      const hour = new Date(record.entryTime).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }

    return Array.from(hourlyMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
  }

  async getAlerts(longParkingHours = 24) {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const longParkingThreshold = new Date(now.getTime() - longParkingHours * 60 * 60 * 1000);

    const [
      expiringPackages,
      inconsistentPackages,
      zones,
      longParkedRecords,
      inconsistentOccupiedSpots,
      suspiciousPayments,
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
      prisma.parkingRecord.findMany({
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
      }),
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
            { amount: { gte: 5000000 } },
            {
              paymentType: 'parking',
              amount: { gte: 300000 },
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
    ]);

    const alerts = [
      ...expiringPackages.map((pkg) => ({
        id: `package-expiring-${pkg.id}`,
        severity: 'warning',
        category: 'package',
        title: 'Gói sắp hết hạn',
        description: `${pkg.vehicle?.licensePlate || 'Không rõ biển số'} • ${pkg.customer?.fullName || 'Khách hàng'} • ${pkg.parkingPackage?.name || 'Gói dịch vụ'} hết hạn ngày ${pkg.endDate.toLocaleDateString('vi-VN')}.`,
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
              severity: 'danger',
              category: 'parking',
              title: 'Khu vực đã đầy',
              description: `${zone.name} hiện không còn chỗ trống (${total}/${total} chỗ đang sử dụng hoặc bảo trì).`,
              occurredAt: now,
              relatedPath: '/parking-spots',
            };
          }
          if (available <= 2 || available / total <= 0.1) {
            return {
              id: `zone-near-full-${zone.id}`,
              severity: 'warning',
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
      ...longParkedRecords.map((record) => ({
        id: `parking-long-${record.id}`,
        severity: 'warning',
        category: 'parking',
        title: 'Xe đỗ quá lâu',
        description: `${record.licensePlate} (${record.vehicleType.name}) đã ở trong bãi từ ${record.entryTime.toLocaleString('vi-VN')} tại ${record.parkingSpot?.zone?.name || 'khu chưa rõ'} - ${record.parkingSpot?.spotNumber || 'chưa gán chỗ'}.`,
        occurredAt: record.entryTime,
        relatedPath: '/parking/history',
      })),
      ...inconsistentOccupiedSpots.map((spot) => ({
        id: `spot-inconsistent-${spot.id}`,
        severity: 'danger',
        category: 'parking',
        title: 'Chỗ đỗ occupied bị lệch dữ liệu',
        description: `${spot.zone?.name || 'Khu chưa rõ'} - ${spot.spotNumber} đang là occupied nhưng không có lượt xe active.`,
        occurredAt: now,
        relatedPath: '/parking-spots',
      })),
      ...suspiciousPayments.map((payment) => ({
        id: `payment-suspicious-${payment.id}`,
        severity: Number(payment.amount) <= 0 ? 'danger' : 'warning',
        category: 'payment',
        title: 'Thanh toán bất thường',
        description: `Giao dịch #${payment.id} có số tiền ${Number(payment.amount).toLocaleString('vi-VN')}đ cho xe ${payment.parkingRecord?.licensePlate || payment.customerPackage?.vehicle?.licensePlate || 'không rõ'} .`,
        occurredAt: payment.paidAt,
        relatedPath: '/payments',
      })),
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
}

export const reportService = new ReportService();
