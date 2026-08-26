import prisma from '../config/prisma';

const WEEKDAY_LABELS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
// Sắp xếp hiển thị bắt đầu từ Thứ 2 -> CN
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Period = 'month' | 'quarter' | 'year';

function rangeForPeriod(period: Period): { start: Date; end: Date; label: string } {
  const end = new Date();
  const start = new Date(end);
  if (period === 'quarter') {
    start.setDate(start.getDate() - 90);
    return { start, end, label: `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)} (quý)` };
  }
  if (period === 'year') {
    start.setDate(start.getDate() - 365);
    return { start, end, label: `${end.getFullYear()} (12 tháng gần nhất)` };
  }
  start.setDate(start.getDate() - 30);
  return { start, end, label: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}` };
}

export class AnalyticsService {
  async getInsights(period: Period = 'month') {
    const { start, end, label } = rangeForPeriod(period);
    const daysInRange = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    const [allRecords, completedRecords, zones, since30Records, activePackageCustomerIds] = await Promise.all([
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: start, lte: end } },
        select: { entryTime: true },
      }),
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: start, lte: end }, status: 'completed' },
        select: {
          fee: true,
          parkingSpotId: true,
          parkingSpot: { select: { zoneId: true } },
        },
      }),
      prisma.parkingZone.findMany({
        include: { parkingSpots: { select: { status: true } } },
        orderBy: { id: 'asc' },
      }),
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        select: { vehicleId: true },
      }),
      prisma.customerPackage.findMany({
        where: { status: 'active', startDate: { lte: end }, endDate: { gte: end } },
        select: { customerId: true },
      }),
    ]);

    const totalRevenue = completedRecords.reduce((sum, r) => sum + Number(r.fee || 0), 0);
    const totalVehicles = allRecords.length;
    const occupiedNow = zones.reduce((sum, z) => sum + z.parkingSpots.filter((s) => s.status === 'occupied').length, 0);
    const totalSpotsNow = zones.reduce((sum, z) => sum + z.parkingSpots.length, 0);

    const summary = {
      totalRevenue,
      totalVehicles,
      avgRevenuePerDay: Math.round(totalRevenue / daysInRange),
      avgVehiclesPerDay: Math.round((totalVehicles / daysInRange) * 10) / 10,
      occupancyRate: totalSpotsNow > 0 ? Math.round((occupiedNow / totalSpotsNow) * 1000) / 10 : 0,
    };

    // --- Phân tích theo ngày trong tuần ---
    const weekdayVehicleCount = new Map<number, number>();
    const weekdayRevenueSum = new Map<number, number>();
    const weekdayOccurrences = new Map<number, number>();
    for (const r of allRecords) {
      const d = new Date(r.entryTime).getDay();
      weekdayVehicleCount.set(d, (weekdayVehicleCount.get(d) || 0) + 1);
    }
    // Đếm số lần mỗi thứ xuất hiện trong khoảng ngày để tính trung bình
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay();
      weekdayOccurrences.set(wd, (weekdayOccurrences.get(wd) || 0) + 1);
    }

    const completedWithEntry = await prisma.parkingRecord.findMany({
      where: { entryTime: { gte: start, lte: end }, status: 'completed' },
      select: { entryTime: true, fee: true },
    });
    for (const r of completedWithEntry) {
      const d = new Date(r.entryTime).getDay();
      weekdayRevenueSum.set(d, (weekdayRevenueSum.get(d) || 0) + Number(r.fee || 0));
    }

    const dayOfWeekAnalysis = WEEKDAY_ORDER.map((wd) => {
      const occurrences = weekdayOccurrences.get(wd) || 1;
      return {
        day: WEEKDAY_LABELS[wd],
        avgVehicles: Math.round(((weekdayVehicleCount.get(wd) || 0) / occurrences) * 10) / 10,
        avgRevenue: Math.round((weekdayRevenueSum.get(wd) || 0) / occurrences),
      };
    });

    // --- Phân tích theo khung giờ ---
    const hourCounts = new Map<number, number>();
    for (const r of allRecords) {
      const h = new Date(r.entryTime).getHours();
      hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    }
    const hourlyAnalysis = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      avgVehicles: Math.round(((hourCounts.get(hour) || 0) / daysInRange) * 10) / 10,
    }));

    // --- Hiệu quả theo khu vực ---
    const zoneRevenue = new Map<number, number>();
    for (const r of completedRecords) {
      const zoneId = r.parkingSpot?.zoneId;
      if (zoneId == null) continue;
      zoneRevenue.set(zoneId, (zoneRevenue.get(zoneId) || 0) + Number(r.fee || 0));
    }
    const zoneEfficiency = zones.map((z) => {
      const total = z.parkingSpots.length;
      const occupied = z.parkingSpots.filter((s) => s.status === 'occupied').length;
      const revenue = zoneRevenue.get(z.id) || 0;
      return {
        zone: z.name,
        totalSpots: total,
        avgOccupancy: total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0,
        revenue,
        revenuePerSpot: total > 0 ? Math.round(revenue / total) : 0,
      };
    });

    // --- Gợi ý quyết định (rule-based DSS) ---
    const decisions: any[] = [];

    const overloadedZones = zoneEfficiency.filter((z) => z.avgOccupancy > 80);
    if (overloadedZones.length > 0) {
      const z = overloadedZones.sort((a, b) => b.avgOccupancy - a.avgOccupancy)[0];
      const underusedZone = [...zoneEfficiency].sort((a, b) => a.avgOccupancy - b.avgOccupancy)[0];
      decisions.push({
        id: 'd1',
        question: `Có nên mở thêm chỗ đỗ ở ${z.zone}?`,
        analysis: `${z.zone} có occupancy ${z.avgOccupancy}% — gần đầy. Doanh thu/chỗ hiện tại: ${z.revenuePerSpot.toLocaleString('vi-VN')}đ.`,
        options: [
          {
            action: `Mở thêm chỗ đỗ ở ${z.zone}`,
            estimatedImpact: `Nếu lấp đầy 80% chỗ mới với doanh thu/chỗ tương đương, có thể tăng thêm ~${Math.round(z.revenuePerSpot * 0.8 * 10).toLocaleString('vi-VN')}đ/${daysInRange <= 31 ? 'tháng' : 'kỳ'} cho mỗi 10 chỗ.`,
            risk: 'Chi phí mở rộng hạ tầng, có thể không lấp đủ ngoài giờ cao điểm.',
          },
          {
            action: underusedZone && underusedZone.zone !== z.zone
              ? `Giữ nguyên, điều phối xe sang ${underusedZone.zone}`
              : 'Giữ nguyên, tối ưu quay vòng chỗ đỗ hiện có',
            estimatedImpact: underusedZone && underusedZone.zone !== z.zone
              ? `Tăng occupancy ${underusedZone.zone} từ ${underusedZone.avgOccupancy}% lên mức cân bằng hơn, không tốn chi phí đầu tư.`
              : 'Không tốn chi phí đầu tư thêm.',
            risk: 'Khách có thể không hài lòng nếu phải đỗ xa hơn hoặc chờ đợi.',
          },
        ],
      });
    }

    const weekdayAvg = dayOfWeekAnalysis
      .filter((d) => d.day !== 'Thứ 7' && d.day !== 'CN')
      .reduce((sum, d) => sum + d.avgVehicles, 0) / 5;
    const weekendAvg = (dayOfWeekAnalysis.find((d) => d.day === 'Thứ 7')?.avgVehicles || 0
      + (dayOfWeekAnalysis.find((d) => d.day === 'CN')?.avgVehicles || 0)) / 2;
    if (weekdayAvg > 0 && weekendAvg < weekdayAvg * 0.5) {
      const dropPercent = Math.round((1 - weekendAvg / weekdayAvg) * 100);
      decisions.push({
        id: 'd2',
        question: 'Có nên điều chỉnh giá vào cuối tuần?',
        analysis: `Cuối tuần chỉ ${Math.round(weekendAvg)} xe/ngày (vs ${Math.round(weekdayAvg)} xe ngày thường) — giảm ${dropPercent}%.`,
        options: [
          {
            action: 'Giảm giá 20% cuối tuần',
            estimatedImpact: 'Có thể thu hút thêm khách vãng lai, tăng occupancy cuối tuần.',
            risk: 'Giảm doanh thu/lượt nếu lượng xe không tăng đủ bù đắp.',
          },
          {
            action: 'Giữ nguyên giá, tăng khuyến mãi gói dịch vụ cuối tuần',
            estimatedImpact: 'Không ảnh hưởng giá gửi lẻ hiện tại, thử nghiệm nhu cầu trước khi đổi giá chính thức.',
            risk: 'Hiệu quả chậm hơn so với giảm giá trực tiếp.',
          },
        ],
      });
    }

    const frequentVehicleIds = new Set<number>();
    const visitCountByVehicle = new Map<number, number>();
    for (const r of since30Records) {
      if (!r.vehicleId) continue;
      visitCountByVehicle.set(r.vehicleId, (visitCountByVehicle.get(r.vehicleId) || 0) + 1);
    }
    for (const [vehicleId, count] of visitCountByVehicle) {
      if (count >= 5) frequentVehicleIds.add(vehicleId);
    }
    if (frequentVehicleIds.size > 0) {
      const frequentVehicles = await prisma.vehicle.findMany({
        where: { id: { in: Array.from(frequentVehicleIds) } },
        select: { customerId: true },
      });
      const withPackageCustomerIds = new Set(activePackageCustomerIds.map((p) => p.customerId));
      const frequentCustomerIds = new Set(frequentVehicles.map((v) => v.customerId));
      const withoutPackageCount = Array.from(frequentCustomerIds).filter((id) => !withPackageCustomerIds.has(id)).length;
      const percentWithoutPackage = Math.round((withoutPackageCount / frequentCustomerIds.size) * 100);
      if (percentWithoutPackage > 20) {
        decisions.push({
          id: 'd3',
          question: 'Có nên triển khai chiến dịch bán gói dịch vụ?',
          analysis: `${percentWithoutPackage}% khách hàng đỗ xe thường xuyên (≥5 lần/tháng) chưa đăng ký gói dịch vụ (${withoutPackageCount}/${frequentCustomerIds.size} khách).`,
          options: [
            {
              action: 'Chạy chiến dịch tư vấn gói dịch vụ cho nhóm khách này',
              estimatedImpact: `Nếu 30% chuyển đổi sang gói tháng, có thể tăng doanh thu ổn định từ ~${Math.round(withoutPackageCount * 0.3)} khách hàng mới.`,
              risk: 'Cần thời gian và nhân lực tư vấn, có thể không phải khách nào cũng phù hợp với gói.',
            },
            {
              action: 'Không triển khai, giữ mô hình gửi lẻ',
              estimatedImpact: 'Không phát sinh chi phí marketing/tư vấn.',
              risk: 'Bỏ lỡ cơ hội tăng doanh thu ổn định và giữ chân khách hàng.',
            },
          ],
        });
      }
    }

    return {
      period: label,
      summary,
      dayOfWeekAnalysis,
      hourlyAnalysis,
      zoneEfficiency,
      decisions,
    };
  }
}

export const analyticsService = new AnalyticsService();
