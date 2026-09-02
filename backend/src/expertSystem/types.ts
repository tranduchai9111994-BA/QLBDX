/**
 * Các kiểu dữ liệu dùng chung của hệ chuyên gia.
 *
 * Cấu trúc một luật, diễn giải bằng lời:
 *   NẾU  <tất cả điều kiện đều đúng>  THÌ  <thực hiện các hành động>
 *
 * Ví dụ luật gợi ý gói tháng:
 *   NẾU  số lần gửi xe trong tháng >= 5
 *   THÌ  gợi ý gói 'monthly', thời hạn 30 ngày, tiết kiệm khoảng 20%
 */
/**
 * Một ĐIỀU KIỆN của luật, dạng: <tên dữ kiện> <toán tử> <ngưỡng>.
 * Ví dụ { fact: 'frequency', operator: 'gte', value: 5 } đọc là "số lần gửi >= 5".
 */
export interface Condition {
  fact: string;
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq';
  value: number;
}

/**
 * HÀNH ĐỘNG khi luật thoả mãn. `type` quyết định service nào sẽ tiêu thụ (recommend / alert /
 * decision / suggestion), `params` là nội dung cụ thể — mỗi loại cần các khoá khác nhau, quy
 * tắc bắt buộc khai báo ở validation.ts.
 */
export interface Action {
  type: string;
  params: Record<string, any>;
}

/**
 * Tập DỮ KIỆN đầu vào cho máy suy diễn — do service nghiệp vụ đo đạc rồi truyền vào.
 *
 * Lưu ý: kiểu khai báo cho phép chuỗi và luận lý, nhưng máy suy diễn hiện chỉ so sánh được
 * dữ kiện kiểu SỐ (xem evaluateCondition trong inferenceEngine.ts) — dữ kiện không phải số
 * bị coi là "không có dữ liệu" và điều kiện đó không thoả.
 */
export type Fact = Record<string, number | string | boolean>;

/**
 * Một LUẬT trong cơ sở tri thức, tương ứng một dòng của bảng ExpertRules.
 *
 * Các điều kiện được nối với nhau bằng VÀ (AND): phải thoả hết thì luật mới cháy.
 * `priority` nhỏ hơn = xét trước, dùng khi nhiều luật cùng nhóm đều thoả (ví dụ ngưỡng gói
 * năm / quý / tháng thì gói năm nên được ưu tiên gợi ý).
 */
export interface Rule {
  id: number;
  code: string;
  domain: string;
  name: string;
  description: string | null;
  priority: number;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
}

/**
 * Kết quả xét MỘT luật.
 *
 * `explanation` chính là phần "giải thích được" (explainability) — đặc trưng quan trọng nhất
 * phân biệt hệ chuyên gia với một mô hình học máy hộp đen: hệ thống nói rõ vì sao nó kết luận
 * như vậy, ví dụ "[Gợi ý gói tháng] Thoả mãn: frequency = 12 >= 5 -> đúng".
 */
export interface RuleResult {
  rule: Rule;
  matched: boolean;
  explanation: string;
  actionOutputs: Action[];
}

/**
 * Kết quả một lượt suy diễn trên cả nhóm luật.
 *   - `results`: kết quả của MỌI luật, kể cả luật không thoả (dùng cho màn hình Test luật).
 *   - `firedRules`: chỉ những luật đã cháy — đây là phần service nghiệp vụ thực sự dùng.
 *   - `explanations`: lời giải thích của các luật đã cháy, để hiển thị cho người dùng.
 */
export interface EvaluationResult {
  results: RuleResult[];
  firedRules: RuleResult[];
  explanations: string[];
}
