/**
 * MÁY SUY DIỄN của hệ chuyên gia — nơi thực sự "ra quyết định".
 *
 * Vị trí trong luồng:
 *   Service nghiệp vụ đo dữ kiện (ví dụ: khách này gửi 12 lần/tháng)
 *     -> inferenceEngine.evaluate(facts, domain)
 *     -> lấy luật của nhóm đó từ Cơ sở tri thức (knowledgeBase.ts)
 *     -> xét từng luật, thu lại luật nào thoả + lời giải thích
 *     -> Service dùng kết quả để sinh gợi ý / cảnh báo cho người dùng
 *
 * Toàn bộ file không đọc cơ sở dữ liệu và không biết gì về nghiệp vụ bãi xe: nó chỉ so khớp dữ
 * kiện với luật. Nhờ vậy thêm một nhóm luật mới không cần sửa file này.
 */
import type { Condition, Fact, Rule, RuleResult, EvaluationResult } from './types';
import { knowledgeBase } from './knowledgeBase';

// Ký hiệu toán tử để in ra trong lời giải thích cho người dùng đọc ("5 >= 3" dễ hiểu hơn "gte").
const OPERATOR_LABELS: Record<string, string> = {
  gte: '>=', lte: '<=', gt: '>', lt: '<', eq: '==', neq: '!=',
};

/**
 * Xét MỘT điều kiện với bộ dữ kiện hiện có.
 *
 * Trả về kèm câu giải thích chứ không chỉ true/false — đây là lý do không dùng thẳng một biểu
 * thức so sánh: hệ chuyên gia phải nói được vì sao nó kết luận như vậy.
 */
function evaluateCondition(condition: Condition, facts: Fact): { matched: boolean; explanation: string } {
  const actual = facts[condition.fact];
  // Thiếu dữ kiện hoặc dữ kiện không phải số thì coi như KHÔNG thoả, thay vì ném lỗi. Chọn hướng
  // an toàn: một luật cấu hình sai chỉ khiến luật đó không cháy, không làm hỏng cả lượt suy diễn.
  if (actual === undefined || typeof actual !== 'number') {
    return { matched: false, explanation: `${condition.fact}: không có dữ liệu` };
  }
  const op = condition.operator;
  const expected = condition.value;
  let matched = false;
  if (op === 'gte') matched = actual >= expected;
  else if (op === 'lte') matched = actual <= expected;
  else if (op === 'gt') matched = actual > expected;
  else if (op === 'lt') matched = actual < expected;
  else if (op === 'eq') matched = actual === expected;
  else if (op === 'neq') matched = actual !== expected;

  const label = OPERATOR_LABELS[op] || op;
  return {
    matched,
    explanation: `${condition.fact} = ${actual} ${label} ${expected} → ${matched ? 'đúng' : 'sai'}`,
  };
}

/**
 * Xét MỘT luật: chạy hết các điều kiện rồi kết luận luật có cháy hay không.
 */
function evaluateRule(rule: Rule, facts: Fact): RuleResult {
  const condResults = rule.conditions.map((c) => evaluateCondition(c, facts));
  // `every` = các điều kiện nối với nhau bằng VÀ (AND). Kèm `length > 0` vì every trên mảng rỗng
  // luôn trả true — nếu bỏ, một luật không có điều kiện nào sẽ cháy với mọi dữ liệu đầu vào.
  const matched = condResults.length > 0 && condResults.every((r) => r.matched);
  const condExplanations = condResults.map((r) => r.explanation).join('; ');
  const explanation = matched
    ? `[${rule.name}] Thỏa mãn: ${condExplanations}`
    : `[${rule.name}] Không thỏa: ${condExplanations}`;

  return {
    rule,
    matched,
    explanation,
    actionOutputs: matched ? rule.actions : [],
  };
}

/**
 * MÁY SUY DIỄN (Inference Engine).
 *
 * Cách suy diễn ở đây là "tiến" (forward chaining): xuất phát từ dữ kiện đã biết, quét qua toàn
 * bộ luật của nhóm và thu lại những luật thoả mãn. Không suy diễn nhiều tầng — kết quả của luật
 * này không trở thành dữ kiện cho luật khác — vì bài toán của hệ thống chỉ cần một tầng và cách
 * này giữ được tính dễ giải thích.
 */
class InferenceEngine {
  /**
   * @param facts  Dữ kiện đo được từ nghiệp vụ.
   * @param domain Chỉ xét luật thuộc nhóm này, để luật cảnh báo không lẫn với luật gợi ý gói.
   */
  async evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
    // Lấy luật từ Cơ sở tri thức. knowledgeBase đã lọc sẵn luật đang bật và sắp xếp theo priority,
    // nên máy suy diễn không phải biết gì về việc luật được lưu ở đâu hay bật/tắt ra sao.
    const rules = await knowledgeBase.getRulesByDomain(domain);
    const results = rules.map((r) => evaluateRule(r, facts));
    // Giữ lại CẢ kết quả của luật không thoả trong `results`: màn hình "Test luật" cần hiển thị
    // vì sao một luật đã KHÔNG cháy, đó cũng là thông tin để người quản trị chỉnh ngưỡng.
    const firedRules = results.filter((r) => r.matched);
    return {
      results,
      firedRules,
      explanations: firedRules.map((r) => r.explanation),
    };
  }
}

export const inferenceEngine = new InferenceEngine();
