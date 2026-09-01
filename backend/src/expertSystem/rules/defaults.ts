/**
 * Seed data — nạp các luật còn thiếu (so theo mã luật) khi khởi động, replicate toàn bộ logic
 * hardcode trước đây.
 *
 * Nội dung câu gợi ý nằm trong action.params.message dưới dạng mẫu có chỗ trống {tenBien};
 * số liệu thật do service điền lúc chạy (xem expertSystem/messageTemplate.ts). Sửa câu chữ ở
 * màn hình quản lý luật là đổi được nội dung gợi ý, không cần sửa code.
 */
export const DEFAULT_RULES = [
  // --- Domain: package (customerPackage.service.ts) ---
  {
    code: 'pkg_recommend_yearly',
    domain: 'package',
    name: 'Gợi ý gói năm',
    description: 'Khách đỗ xe >= 20 lần/tháng → gợi ý gói năm, tiết kiệm ~40%',
    priority: 10,
    conditions: JSON.stringify([{ fact: 'frequency', operator: 'gte', value: 20 }]),
    actions: JSON.stringify([{ type: 'recommend', params: { package: 'yearly', savings: '~40%', durationDays: 365 } }]),
  },
  {
    code: 'pkg_recommend_quarterly',
    domain: 'package',
    name: 'Gợi ý gói quý',
    description: 'Khách đỗ xe >= 12 lần/tháng → gợi ý gói quý, tiết kiệm ~30%',
    priority: 20,
    conditions: JSON.stringify([{ fact: 'frequency', operator: 'gte', value: 12 }]),
    actions: JSON.stringify([{ type: 'recommend', params: { package: 'quarterly', savings: '~30%', durationDays: 90 } }]),
  },
  {
    code: 'pkg_recommend_monthly',
    domain: 'package',
    name: 'Gợi ý gói tháng',
    description: 'Khách đỗ xe >= 5 lần/tháng → gợi ý gói tháng, tiết kiệm ~20%',
    priority: 30,
    conditions: JSON.stringify([{ fact: 'frequency', operator: 'gte', value: 5 }]),
    actions: JSON.stringify([{ type: 'recommend', params: { package: 'monthly', savings: '~20%', durationDays: 30 } }]),
  },

  // --- Domain: analytics (analytics.service.ts DSS decisions) ---
  {
    code: 'dss_zone_overloaded',
    domain: 'analytics',
    name: 'Khu vực quá tải',
    description: 'Occupancy trung bình > 80% → gợi ý mở thêm chỗ đỗ hoặc điều phối',
    priority: 10,
    conditions: JSON.stringify([{ fact: 'maxZoneOccupancy', operator: 'gt', value: 80 }]),
    actions: JSON.stringify([
      { type: 'decision', params: { id: 'd1', template: 'expand_zone', message: 'Có nên mở thêm chỗ đỗ ở {zone}?' } },
    ]),
  },
  {
    code: 'dss_weekend_drop',
    domain: 'analytics',
    name: 'Sụt giảm cuối tuần',
    description: 'Lượng xe cuối tuần < 50% ngày thường → gợi ý điều chỉnh giá',
    priority: 20,
    conditions: JSON.stringify([{ fact: 'weekendDropPercent', operator: 'gt', value: 50 }]),
    actions: JSON.stringify([
      { type: 'decision', params: { id: 'd2', template: 'weekend_pricing', message: 'Có nên điều chỉnh giá vào cuối tuần?' } },
    ]),
  },
  {
    code: 'dss_package_campaign',
    domain: 'analytics',
    name: 'Chiến dịch bán gói dịch vụ',
    description: '> 20% khách thường xuyên chưa có gói → gợi ý chiến dịch bán gói',
    priority: 30,
    conditions: JSON.stringify([{ fact: 'percentWithoutPackage', operator: 'gt', value: 20 }]),
    actions: JSON.stringify([
      { type: 'decision', params: { id: 'd3', template: 'package_campaign', message: 'Có nên triển khai chiến dịch bán gói dịch vụ?' } },
    ]),
  },

  // --- Domain: report (report.service.ts weekly insights) ---
  {
    code: 'insight_revenue_up',
    domain: 'report',
    name: 'Doanh thu tăng',
    description: 'Doanh thu tuần tăng > 10% → gợi ý bố trí nhân viên',
    priority: 10,
    conditions: JSON.stringify([{ fact: 'revenueChangePercent', operator: 'gt', value: 10 }]),
    actions: JSON.stringify([
      {
        type: 'suggestion',
        params: {
          type: 'revenue_up',
          message: 'Doanh thu tuần này tăng {revenueChangePercent}% so với tuần trước. Giờ cao điểm chiều ({peakAfternoonHour}h) đông nhất — cân nhắc bố trí thêm nhân viên.',
        },
      },
    ]),
  },
  {
    code: 'insight_revenue_down',
    domain: 'report',
    name: 'Doanh thu giảm',
    description: 'Doanh thu tuần giảm > 10% → cần xem xét nguyên nhân',
    priority: 20,
    conditions: JSON.stringify([{ fact: 'revenueChangePercent', operator: 'lt', value: -10 }]),
    actions: JSON.stringify([
      {
        type: 'suggestion',
        params: {
          type: 'revenue_down',
          message: 'Doanh thu tuần này giảm {revenueDropPercent}% so với tuần trước, cần xem xét nguyên nhân (lượng xe, giá, cạnh tranh...).',
        },
      },
    ]),
  },
  {
    code: 'insight_zone_busy',
    domain: 'report',
    name: 'Khu vực đông',
    description: 'Occupancy rate > 80% → cảnh báo điều phối',
    priority: 30,
    conditions: JSON.stringify([{ fact: 'zoneOccupancyRate', operator: 'gt', value: 0.8 }]),
    actions: JSON.stringify([
      {
        type: 'suggestion',
        params: {
          type: 'occupancy_warning',
          message: '{zoneName} đạt {zoneOccupancyPercent}% công suất. Nên cân nhắc điều phối xe sang khu khác còn trống.',
        },
      },
    ]),
  },
  {
    code: 'insight_long_parked',
    domain: 'report',
    name: 'Xe đỗ quá lâu',
    description: 'Số xe đỗ > 24h vượt 5 chiếc → cần kiểm tra',
    priority: 40,
    conditions: JSON.stringify([{ fact: 'longParkedCount', operator: 'gt', value: 5 }]),
    actions: JSON.stringify([
      {
        type: 'suggestion',
        params: { type: 'long_parking', message: 'Có {longParkedCount} xe đỗ quá 24 giờ, cần kiểm tra và xử lý.' },
      },
    ]),
  },
  {
    code: 'insight_expiring_packages',
    domain: 'report',
    name: 'Gói sắp hết hạn',
    description: '> 10 khách sắp hết gói trong 7 ngày → cơ hội gia hạn',
    priority: 50,
    conditions: JSON.stringify([{ fact: 'expiringPackagesCount', operator: 'gt', value: 10 }]),
    actions: JSON.stringify([
      {
        type: 'suggestion',
        params: {
          type: 'renewal_campaign',
          message: '{expiringPackagesCount} khách hàng sắp hết gói trong 7 ngày tới — cơ hội triển khai chiến dịch gia hạn.',
        },
      },
    ]),
  },
];
