/**
 * Nghiệp vụ PHÂN TÍCH VẬN HÀNH (Decision Support System - hỗ trợ ra quyết định).
 *
 * Vị trí trong luồng:
 *   pages/Analytics.tsx -> /api/analytics/insights -> file này -> hệ chuyên gia (nhóm 'analytics')
 *
 * Khác với report.service.ts (trả số liệu thô để vẽ biểu đồ), file này trả về các NHẬN ĐỊNH:
 * hệ thống đọc số liệu, đối chiếu với bộ luật rồi đề xuất hành động kèm lý do.
 */
import prisma from '../config/prisma';
import { evaluate, renderMessage } from '../expertSystem';

const WEEKDAY_LABELS = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
// Sắp xếp hiển thị bắt đầu từ Thứ 2 -> CN
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Period = 'month' | 'quarter' | 'year';

/**
 * Quy đổi kỳ phân tích thành khoảng ngày cụ thể, tính LÙI từ hôm nay:
 *   month = 30 ngày gần nhất, quarter = 90 ngày, year = 365 ngày.
 *
 * Cố ý dùng "N ngày gần nhất" thay vì "tháng/quý theo lịch": đầu tháng mà so theo lịch thì kỳ
 * hiện tại chỉ có vài ngày dữ liệu, đối chiếu với kỳ trước sẽ ra kết luận sai lệch.
 */
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
  /**
   * Phân tích chuyên sâu cho màn hình Phân tích (pages/Analytics.tsx).
   *
   * Quy trình: đo các chỉ số vận hành trong kỳ (lượt xe theo ngày trong tuần, tỷ lệ lấp đầy theo
   * khu, doanh thu, tỷ lệ khách dùng gói) -> đưa vào hệ chuyên gia với nhóm luật 'analytics'
   * -> nhận về các khối "hỗ trợ ra quyết định" kèm lời giải thích vì sao hệ thống kết luận vậy.
   *
   * `renderMessage` thay các biến trong nội dung luật bằng số liệu thật, ví dụ mẫu câu
   * "Khu {zone} đã lấp đầy {rate}%" trở thành "Khu B đã lấp đầy 92%".
   */
  async getInsights(period: Period = 'month') {
    const { start, end, label } = rangeForPeriod(period);
    const daysInRange = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    const [
      allRecords,
      completedRecords,
      zones,
      occupancyRecords,
      since30Records,
      activePackageCustomerIds,
      suggestedRecords,
    ] = await Promise.all([
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
      // Mọi lượt đỗ có giao với khoảng [start, end] (kể cả đang parked) — dùng để tính % thời
      // gian thực sự có xe trong kỳ, thay vì lấy trạng thái "hiện tại" (sai lệch khi xem kỳ quá khứ).
      prisma.parkingRecord.findMany({
        where: {
          parkingSpotId: { not: null },
          entryTime: { lte: end },
          OR: [{ exitTime: null }, { exitTime: { gte: start } }],
        },
        select: { entryTime: true, exitTime: true, parkingSpotId: true, parkingSpot: { select: { zoneId: true } } },
      }),
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        select: { vehicleId: true },
      }),
      prisma.customerPackage.findMany({
        where: { status: 'active', startDate: { lte: end }, endDate: { gte: end } },
        select: { customerId: true },
      }),
      // Các lượt xe vào trong kỳ mà hệ thống CÓ đưa ra gợi ý chỗ đỗ — mẫu số của acceptance rate.
      // Lọc suggestedSpotId khác null ngay ở truy vấn: bản ghi không có gợi ý (dữ liệu trước khi
      // có tính năng này, xe lạ, hoặc nhân viên nhập tay) không nói lên điều gì về chất lượng
      // thuật toán nên phải loại khỏi phép tính, không được tính là "từ chối gợi ý".
      prisma.parkingRecord.findMany({
        where: { entryTime: { gte: start, lte: end }, suggestedSpotId: { not: null } },
        select: { suggestedSpotId: true, parkingSpotId: true },
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
    // % thời gian có xe trong kỳ = tổng (giờ đỗ giao với kỳ) / (số chỗ × độ dài kỳ) — không
    // phải trạng thái "đang occupied ngay lúc gọi API", vốn sai lệch khi xem báo cáo kỳ trước.
    const periodMs = Math.max(1, end.getTime() - start.getTime());
    const zoneOccupiedMs = new Map<number, number>();
    for (const r of occupancyRecords) {
      const zoneId = r.parkingSpot?.zoneId;
      if (zoneId == null) continue;
      const overlapStart = Math.max(new Date(r.entryTime).getTime(), start.getTime());
      const overlapEnd = Math.min(r.exitTime ? new Date(r.exitTime).getTime() : end.getTime(), end.getTime());
      const overlapMs = Math.max(0, overlapEnd - overlapStart);
      zoneOccupiedMs.set(zoneId, (zoneOccupiedMs.get(zoneId) || 0) + overlapMs);
    }
    const zoneEfficiency = zones.map((z) => {
      const total = z.parkingSpots.length;
      const revenue = zoneRevenue.get(z.id) || 0;
      const occupiedMs = zoneOccupiedMs.get(z.id) || 0;
      const capacityMs = total * periodMs;
      return {
        zone: z.name,
        totalSpots: total,
        avgOccupancy: capacityMs > 0 ? Math.round((occupiedMs / capacityMs) * 1000) / 10 : 0,
        revenue,
        revenuePerSpot: total > 0 ? Math.round(revenue / total) : 0,
      };
    });

    // --- Gợi ý quyết định (rule-based DSS qua expert system) ---
    const decisions: any[] = [];

    const maxZoneOccupancy = zoneEfficiency.length > 0
      ? Math.max(...zoneEfficiency.map((z) => z.avgOccupancy))
      : 0;

    const weekdayAvg = dayOfWeekAnalysis
      .filter((d) => d.day !== 'Thứ 7' && d.day !== 'CN')
      .reduce((sum, d) => sum + d.avgVehicles, 0) / 5;
    const weekendAvg = (dayOfWeekAnalysis.find((d) => d.day === 'Thứ 7')?.avgVehicles || 0
      + (dayOfWeekAnalysis.find((d) => d.day === 'CN')?.avgVehicles || 0)) / 2;
    const weekendDropPercent = weekdayAvg > 0 ? Math.round((1 - weekendAvg / weekdayAvg) * 100) : 0;

    const frequentVehicleIds = new Set<number>();
    const visitCountByVehicle = new Map<number, number>();
    for (const r of since30Records) {
      if (!r.vehicleId) continue;
      visitCountByVehicle.set(r.vehicleId, (visitCountByVehicle.get(r.vehicleId) || 0) + 1);
    }
    for (const [vehicleId, count] of visitCountByVehicle) {
      if (count >= 5) frequentVehicleIds.add(vehicleId);
    }
    let percentWithoutPackage = 0;
    let withoutPackageCount = 0;
    let frequentCustomerIds = new Set<number>();
    if (frequentVehicleIds.size > 0) {
      const frequentVehicles = await prisma.vehicle.findMany({
        where: { id: { in: Array.from(frequentVehicleIds) } },
        select: { customerId: true },
      });
      const withPackageCustomerIds = new Set(activePackageCustomerIds.map((p) => p.customerId));
      frequentCustomerIds = new Set(frequentVehicles.map((v) => v.customerId));
      withoutPackageCount = Array.from(frequentCustomerIds).filter((id) => !withPackageCustomerIds.has(id)).length;
      percentWithoutPackage = Math.round((withoutPackageCount / frequentCustomerIds.size) * 100);
    }

    const dssResult = await evaluate(
      { maxZoneOccupancy, weekendDropPercent, percentWithoutPackage },
      'analytics',
    );
    const firedIds = new Set(dssResult.firedRules.map((r) => r.actionOutputs[0]?.params?.id));
    const explanationById = new Map(dssResult.firedRules.map((r) => [r.actionOutputs[0]?.params?.id, r.explanation]));
    // Câu hỏi quyết định lấy từ chính luật (action.params.message) — sửa được ở màn hình quản lý luật.
    const messageById = new Map(dssResult.firedRules.map((r) => [r.actionOutputs[0]?.params?.id, r.actionOutputs[0]?.params?.message]));

    if (firedIds.has('d1')) {
      const z = [...zoneEfficiency].sort((a, b) => b.avgOccupancy - a.avgOccupancy)[0];
      const underusedZone = [...zoneEfficiency].sort((a, b) => a.avgOccupancy - b.avgOccupancy)[0];
      decisions.push({
        id: 'd1',
        question: renderMessage(messageById.get('d1'), { zone: z.zone }),
        analysis: `${z.zone} có occupancy ${z.avgOccupancy}% — gần đầy. Doanh thu/chỗ hiện tại: ${z.revenuePerSpot.toLocaleString('vi-VN')}đ.`,
        explanation: explanationById.get('d1'),
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

    if (firedIds.has('d2')) {
      decisions.push({
        id: 'd2',
        question: renderMessage(messageById.get('d2')),
        analysis: `Cuối tuần chỉ ${Math.round(weekendAvg)} xe/ngày (vs ${Math.round(weekdayAvg)} xe ngày thường) — giảm ${weekendDropPercent}%.`,
        explanation: explanationById.get('d2'),
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

    if (firedIds.has('d3')) {
      decisions.push({
        id: 'd3',
        question: renderMessage(messageById.get('d3')),
        analysis: `${percentWithoutPackage}% khách hàng đỗ xe thường xuyên (≥5 lần/tháng) chưa đăng ký gói dịch vụ (${withoutPackageCount}/${frequentCustomerIds.size} khách).`,
        explanation: explanationById.get('d3'),
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

    // --- Hiệu quả thuật toán gợi ý chỗ đỗ (SAW) ---------------------------------------------
    //
    // ACCEPTANCE RATE = % lượt nhân viên GIỮ NGUYÊN chỗ mà thuật toán gợi ý.
    //
    // Vì sao chỉ số này đo được chất lượng thuật toán: nhân viên đứng tại quầy là người nắm rõ
    // thực tế bãi nhất (xe cồng kềnh, khách đi cùng nhóm, chỗ đang có vũng nước...). Họ được
    // quyền đổi chỗ tuỳ ý — ô chọn chỗ chỉ được điền sẵn chứ không khoá. Nên tỷ lệ họ chấp nhận
    // gợi ý chính là "phiếu bầu" của người dùng thật cho thuật toán.
    //
    // Cách đọc con số: tỷ lệ cao nghĩa là gợi ý sát thực tế; tỷ lệ thấp nghĩa là thuật toán đang
    // bỏ sót yếu tố nào đó mà nhân viên nhìn thấy — lúc đó nên xem lại trọng số 5 tiêu chí.
    //
    // LƯU Ý khi đọc: chỉ tính trên các lượt CÓ gợi ý (mẫu số = suggestedRecords.length). Toàn bộ
    // bản ghi trước khi có tính năng này không lưu gợi ý nên không nằm trong phép tính — kỳ nào
    // chưa phát sinh lượt nào có gợi ý thì trả về null chứ không trả 0, để giao diện phân biệt
    // được "chưa có dữ liệu" với "gợi ý bị từ chối hoàn toàn".
    const suggestionSampleSize = suggestedRecords.length;
    const acceptedCount = suggestedRecords.filter((r) => r.suggestedSpotId === r.parkingSpotId).length;
    const algorithmEffectiveness = {
      algorithm: 'SAW — Simple Additive Weighting',
      sampleSize: suggestionSampleSize,
      acceptedCount,
      overriddenCount: suggestionSampleSize - acceptedCount,
      acceptanceRate:
        suggestionSampleSize > 0
          ? Math.round((acceptedCount / suggestionSampleSize) * 1000) / 10
          : null,
    };

    return {
      period: label,
      summary,
      dayOfWeekAnalysis,
      hourlyAnalysis,
      zoneEfficiency,
      algorithmEffectiveness,
      decisions,
    };
  }
}

export const analyticsService = new AnalyticsService();
