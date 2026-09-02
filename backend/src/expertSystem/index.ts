/**
 * Cửa ngõ (entry point) của HỆ CHUYÊN GIA — điểm nhấn của đồ án.
 *
 * Hệ chuyên gia là cách thay các câu lệnh if/else viết cứng trong code bằng một BỘ LUẬT lưu
 * trong cơ sở dữ liệu, để người quản trị tự thêm/sửa quy tắc trên giao diện mà không phải sửa
 * code và biên dịch lại.
 *
 * Ba thành phần kinh điển của một hệ chuyên gia, ánh xạ sang các file trong thư mục này:
 *
 *   1. CƠ SỞ TRI THỨC (Knowledge Base) — knowledgeBase.ts
 *      Toàn bộ luật, đọc từ bảng ExpertRules và giữ trong bộ nhớ đệm.
 *
 *   2. MÁY SUY DIỄN (Inference Engine) — inferenceEngine.ts
 *      Đối chiếu dữ kiện với từng luật, quyết định luật nào "cháy" (fire) và sinh lời giải thích.
 *
 *   3. DỮ KIỆN (Facts) — do các service nghiệp vụ cung cấp
 *      Ví dụ: số lần khách gửi xe trong tháng, tỷ lệ lấp đầy của khu, mức tăng/giảm doanh thu.
 *
 * Các file hỗ trợ: types.ts (kiểu dữ liệu), validation.ts (kiểm tra luật lúc lưu),
 * domainSpecs.ts (khai báo giá trị hợp lệ + khuôn form nhập luật), messageTemplate.ts
 * (chèn biến vào nội dung thông báo), rules/defaults.ts (bộ luật mặc định lúc khởi tạo).
 *
 * File index.ts này chỉ gom các thành phần lại để nơi khác `import ... from '../expertSystem'`
 * một lần, thay vì phải nhớ đường dẫn của từng file con.
 */
import { knowledgeBase } from './knowledgeBase';
import { inferenceEngine } from './inferenceEngine';
import type { Fact, EvaluationResult } from './types';

export { knowledgeBase } from './knowledgeBase';
export { inferenceEngine } from './inferenceEngine';
export type { Condition, Action, Fact, Rule, RuleResult, EvaluationResult } from './types';
export { validateRule, ruleError } from './validation';
export { renderMessage } from './messageTemplate';
export {
  RULE_TYPES,
  VALID_SEVERITIES,
  PACKAGE_LEVELS,
  ANALYTICS_DECISION_IDS,
  REPORT_SUGGESTION_TYPES,
  DOMAIN_ACTION_TYPE,
  DOMAIN_FORM_SPEC,
} from './domainSpecs';
export type { RuleType, DomainFormSpec, RuleFormField } from './domainSpecs';

/**
 * Chạy suy diễn: đưa vào bộ dữ kiện, nhận về các luật đã "cháy" cùng lời giải thích.
 *
 * @param facts  Dữ kiện đo được từ hệ thống, ví dụ { frequency: 12, avgHours: 6 }.
 * @param domain Nhóm luật cần xét ('package' | 'alert' | 'analytics' | 'report').
 */
export async function evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
  return inferenceEngine.evaluate(facts, domain);
}

/** Nạp lại bộ luật từ DB — gọi sau mỗi lần thêm/sửa/xoá/bật/tắt luật ở màn hình quản trị. */
export async function reload(): Promise<void> {
  return knowledgeBase.reload();
}
