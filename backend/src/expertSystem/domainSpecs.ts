/**
 * Khai báo tập giá trị hợp lệ của từng domain luật — "hợp đồng" giữa Knowledge Base và code
 * tiêu thụ luật. Đặt riêng ở đây (không nằm trong service) để cả validation của Inference Engine
 * và các service nghiệp vụ dùng chung một nguồn, tránh import vòng.
 */

export const VALID_SEVERITIES = ['danger', 'warning', 'info'] as const;

/** Loại cảnh báo hợp lệ + đơn vị + chiều so sánh — cố định trong code, admin chỉ thêm/sửa mốc ngưỡng. */
export const RULE_TYPES = {
  zoneNearFullPercent: { label: 'Khu vực sắp đầy', unit: '% chỗ trống còn lại', comparator: 'lte' as const },
  zoneImbalanceMaxPercent: { label: 'Mất cân bằng khu vực', unit: '% khu quá tải', comparator: 'gte' as const },
  longParkingHours: { label: 'Xe đỗ quá lâu', unit: 'giờ đã đỗ', comparator: 'gte' as const },
  parkingAnomalyMultiplier: { label: 'Xe đỗ bất thường', unit: 'lần so với trung bình', comparator: 'gte' as const },
  suspiciousPaymentAmount: { label: 'Thanh toán bất thường', unit: 'đ', comparator: 'gte' as const },
  revenueDropPercent: { label: 'Doanh thu sụt giảm', unit: '% sụt so với hôm qua', comparator: 'gte' as const },
  renewalFrequency: { label: 'Gợi ý gia hạn', unit: 'lần đỗ xe/tháng', comparator: 'gte' as const },
} as const;

export type RuleType = keyof typeof RULE_TYPES;

/** Mức gói mà customerPackage.service.ts biết cách tra cứu và trả về cho frontend. */
export const PACKAGE_LEVELS = ['yearly', 'quarterly', 'monthly'] as const;

/** Mã quyết định mà analytics.service.ts có sẵn khối phân tích/phương án tương ứng. */
export const ANALYTICS_DECISION_IDS = ['d1', 'd2', 'd3'] as const;

/** Loại gợi ý mà report.service.ts biết cách hiển thị trên báo cáo tuần. */
export const REPORT_SUGGESTION_TYPES = [
  'revenue_up',
  'revenue_down',
  'occupancy_warning',
  'long_parking',
  'renewal_campaign',
] as const;

/** Kiểu action bắt buộc theo từng domain — 1 domain chỉ dùng đúng 1 loại action. */
export const DOMAIN_ACTION_TYPE: Record<string, string> = {
  package: 'recommend',
  alert: 'alert',
  analytics: 'decision',
  report: 'suggestion',
};
