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
  parking_recommendation: 'config',
};

/**
 * Tên 5 tiêu chí của thuật toán SAW (gợi ý chỗ đỗ) — thứ tự PHẢI khớp thứ tự trong
 * utils/smartParkingAlgorithms.ts, vì trọng số được đọc ra theo đúng thứ tự này.
 */
export const SAW_WEIGHT_KEYS = [
  'zonePreference',
  'zoneAvailability',
  'typeMatch',
  'peakHourFit',
  'occupancy',
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Mô tả form nhập luật cho giao diện quản trị.
 *
 * Sinh form từ đây (thay vì để admin gõ JSON tay) nên màn hình luôn khớp với
 * validate ở validation.ts — thêm 1 giá trị hợp lệ mới thì cả dropdown lẫn
 * validate cùng đổi theo, không lệch nhau.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface RuleFormOption {
  value: string;
  label: string;
}

export interface RuleFormField {
  /** Tên khoá trong action.params */
  name: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'textarea';
  required: boolean;
  options?: RuleFormOption[];
  placeholder?: string;
  help?: string;
  /** Với ô nội dung: các chỗ trống {tenBien} dùng được, hệ thống điền số liệu thật lúc chạy. */
  variables?: { name: string; description: string }[];
}

export interface DomainFormSpec {
  label: string;
  description: string;
  /** Loại hành động cố định của domain — admin không cần (và không được) tự gõ. */
  actionType: string;
  /** Gợi ý dữ kiện dùng được ở phần Điều kiện. */
  facts: { name: string; label: string; help?: string }[];
  fields: RuleFormField[];
}

export const DOMAIN_FORM_SPEC: Record<string, DomainFormSpec> = {
  package: {
    label: 'Gợi ý gói dịch vụ',
    description: 'Khi khách đỗ xe đủ thường xuyên thì gợi ý mua gói tháng/quý/năm.',
    actionType: 'recommend',
    facts: [
      { name: 'frequency', label: 'Số lần đỗ xe trong 30 ngày gần nhất', help: 'Đếm từ lịch sử ra/vào của khách' },
    ],
    fields: [
      {
        name: 'package',
        label: 'Mức gói gợi ý',
        type: 'select',
        required: true,
        options: [
          { value: 'monthly', label: 'Gói tháng' },
          { value: 'quarterly', label: 'Gói quý' },
          { value: 'yearly', label: 'Gói năm' },
        ],
      },
      {
        name: 'durationDays',
        label: 'Thời hạn gói (số ngày)',
        type: 'number',
        required: true,
        help: 'Phải khớp thời hạn của một gói dịch vụ đang bán, nếu không hệ thống sẽ không tra ra gói để gợi ý.',
      },
      {
        name: 'savings',
        label: 'Mức tiết kiệm hiển thị cho khách',
        type: 'text',
        required: true,
        placeholder: '~20%',
      },
    ],
  },

  analytics: {
    label: 'Hỗ trợ ra quyết định (DSS)',
    description: 'Khi số liệu vượt ngưỡng thì đưa câu hỏi quyết định kèm các phương án cho quản lý.',
    actionType: 'decision',
    facts: [
      { name: 'maxZoneOccupancy', label: 'Tỷ lệ lấp đầy cao nhất trong các khu (%)' },
      { name: 'weekendDropPercent', label: 'Mức sụt giảm lượng xe cuối tuần so với ngày thường (%)' },
      { name: 'percentWithoutPackage', label: 'Tỷ lệ khách đỗ thường xuyên chưa có gói (%)' },
    ],
    fields: [
      {
        name: 'id',
        label: 'Quyết định hiển thị',
        type: 'select',
        required: true,
        help: 'Mỗi quyết định đã có sẵn khối phân tích và 2 phương án tương ứng trong màn Phân tích & Gợi ý.',
        options: [
          { value: 'd1', label: 'd1 — Mở thêm chỗ đỗ / điều phối sang khu trống' },
          { value: 'd2', label: 'd2 — Điều chỉnh giá cuối tuần' },
          { value: 'd3', label: 'd3 — Chiến dịch bán gói dịch vụ' },
        ],
      },
      {
        name: 'message',
        label: 'Câu hỏi quyết định',
        type: 'textarea',
        required: true,
        placeholder: 'Có nên mở thêm chỗ đỗ ở {zone}?',
        variables: [
          { name: 'zone', description: 'Tên khu vực có tỷ lệ lấp đầy cao nhất (chỉ dùng được ở quyết định d1)' },
        ],
      },
    ],
  },

  report: {
    label: 'Gợi ý trên báo cáo tuần',
    description: 'Khi số liệu tuần vượt ngưỡng thì hiện một dòng gợi ý hành động trên Dashboard thông minh.',
    actionType: 'suggestion',
    facts: [
      { name: 'revenueChangePercent', label: 'Thay đổi doanh thu tuần này so với tuần trước (%)', help: 'Số âm nghĩa là giảm' },
      { name: 'longParkedCount', label: 'Số xe đang đỗ quá 24 giờ' },
      { name: 'expiringPackagesCount', label: 'Số khách sắp hết gói trong 7 ngày tới' },
      { name: 'zoneOccupancyRate', label: 'Tỷ lệ lấp đầy của một khu (0 đến 1)', help: 'VD 0.8 nghĩa là 80%' },
    ],
    fields: [
      {
        name: 'type',
        label: 'Loại gợi ý',
        type: 'select',
        required: true,
        options: [
          { value: 'revenue_up', label: 'Doanh thu tăng' },
          { value: 'revenue_down', label: 'Doanh thu giảm' },
          { value: 'occupancy_warning', label: 'Khu vực đông — cần điều phối' },
          { value: 'long_parking', label: 'Xe đỗ quá lâu' },
          { value: 'renewal_campaign', label: 'Cơ hội gia hạn gói' },
        ],
      },
      {
        name: 'message',
        label: 'Nội dung gợi ý hiển thị cho quản lý',
        type: 'textarea',
        required: true,
        placeholder: 'Có {longParkedCount} xe đỗ quá 24 giờ, cần kiểm tra và xử lý.',
        variables: [
          { name: 'revenueChangePercent', description: '% thay đổi doanh thu, giữ nguyên dấu âm/dương' },
          { name: 'revenueDropPercent', description: '% sụt giảm doanh thu, luôn là số dương' },
          { name: 'peakAfternoonHour', description: 'Giờ cao điểm buổi chiều' },
          { name: 'longParkedCount', description: 'Số xe đỗ quá 24 giờ' },
          { name: 'expiringPackagesCount', description: 'Số khách sắp hết gói' },
          { name: 'zoneName', description: 'Tên khu vực (chỉ dùng được ở loại "Khu vực đông")' },
          { name: 'zoneOccupancyPercent', description: 'Tỷ lệ lấp đầy của khu, đã quy ra % (chỉ dùng được ở loại "Khu vực đông")' },
        ],
      },
    ],
  },

  parking_recommendation: {
    label: 'Gợi ý chỗ đỗ (thuật toán SAW)',
    description:
      'Trọng số 5 tiêu chí mà thuật toán SAW dùng để xếp hạng chỗ đỗ trống khi nhân viên nhập biển số. Tổng 5 trọng số phải bằng 1.0 — tăng trọng số nào thì tiêu chí đó chi phối kết quả gợi ý nhiều hơn.',
    actionType: 'config',
    facts: [
      {
        name: 'configOnly',
        label: 'Không dùng điều kiện',
        help: 'Luật này chỉ lưu tham số, không chạy qua máy suy diễn. Giữ nguyên điều kiện mặc định configOnly >= 0.',
      },
    ],
    fields: [
      {
        name: 'zonePreference',
        label: 'C1 — Mức ưa thích chỗ đỗ',
        type: 'number',
        required: true,
        help: 'Khách hay đỗ khu nào và đúng chỗ nào gần đây (tính theo Exponential Decay). Mặc định 0.35.',
      },
      {
        name: 'zoneAvailability',
        label: 'C2 — Tỷ lệ còn trống của khu',
        type: 'number',
        required: true,
        help: 'Ưu tiên khu còn nhiều chỗ, tránh dồn xe vào một khu. Mặc định 0.25.',
      },
      {
        name: 'typeMatch',
        label: 'C3 — Độ phù hợp loại xe',
        type: 'number',
        required: true,
        help: 'Khu chuyên đúng loại xe được cộng điểm so với khu tổng hợp. Mặc định 0.20.',
      },
      {
        name: 'peakHourFit',
        label: 'C4 — Phù hợp khung giờ quen',
        type: 'number',
        required: true,
        help: 'Khu khách hay đỗ vào đúng khung giờ hiện tại. Mặc định 0.10.',
      },
      {
        name: 'occupancy',
        label: 'C5 — Mức độ vắng của khu',
        type: 'number',
        required: true,
        help: 'Khu đang ít xe được ưu tiên. Mặc định 0.10.',
      },
      {
        name: 'decayAlpha',
        label: 'Hệ số suy giảm α (0 < α < 1)',
        type: 'number',
        required: true,
        help: 'α càng lớn thì các lượt đỗ gần đây càng áp đảo lượt cũ. Mặc định 0.3. Không tính vào tổng trọng số.',
      },
    ],
  },

  alert: {
    label: 'Ngưỡng cảnh báo',
    description: 'Nên cấu hình ở tab "Cấu hình mức độ" cho tiện — ở đó chọn loại/ngưỡng/mức độ bằng dropdown.',
    actionType: 'alert',
    facts: Object.entries(RULE_TYPES).map(([name, meta]) => ({
      name,
      label: `${meta.label} (${meta.unit})`,
      help: meta.comparator === 'gte' ? 'So sánh theo chiều >=' : 'So sánh theo chiều <=',
    })),
    fields: [
      {
        name: 'severity',
        label: 'Mức độ nghiêm trọng',
        type: 'select',
        required: true,
        options: [
          { value: 'danger', label: 'Nguy hiểm' },
          { value: 'warning', label: 'Cảnh báo' },
          { value: 'info', label: 'Thông tin' },
        ],
      },
      {
        name: 'message',
        label: 'Nội dung cảnh báo',
        type: 'textarea',
        required: true,
        placeholder: 'Xe đỗ quá lâu: giá trị {value} >= mốc 24giờ đã đỗ → mức warning',
        variables: [{ name: 'value', description: 'Giá trị đo được thực tế tại thời điểm cảnh báo' }],
      },
    ],
  },
};
