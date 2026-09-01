import prisma from '../config/prisma';
import { knowledgeBase, renderMessage, validateRule, RULE_TYPES, VALID_SEVERITIES } from '../expertSystem';
import type { RuleType } from '../expertSystem';

// Tập giá trị hợp lệ được khai báo tập trung ở expertSystem/domainSpecs.ts để validate luật
// domain "alert" và service này dùng chung một nguồn. Re-export cho controller đang import từ đây.
export { RULE_TYPES, VALID_SEVERITIES };
export type { RuleType };

interface TierSpec {
  ruleType: RuleType;
  threshold: number;
  severity: string;
}

/** Mốc mặc định — seed 1 lần khi chưa có luật "alert" nào (cài đặt lần đầu, chưa từng chạy AlertRuleTier cũ). */
const DEFAULT_TIERS: TierSpec[] = [
  { ruleType: 'zoneNearFullPercent', threshold: 10, severity: 'warning' },
  { ruleType: 'zoneImbalanceMaxPercent', threshold: 90, severity: 'warning' },
  { ruleType: 'longParkingHours', threshold: 24, severity: 'warning' },
  { ruleType: 'parkingAnomalyMultiplier', threshold: 3, severity: 'warning' },
  { ruleType: 'suspiciousPaymentAmount', threshold: 5000000, severity: 'warning' },
  { ruleType: 'revenueDropPercent', threshold: 30, severity: 'warning' },
  { ruleType: 'renewalFrequency', threshold: 5, severity: 'info' },
];

interface AlertTier {
  id: number;
  ruleType: string;
  threshold: number;
  severity: string;
  message: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: number | null;
}

interface GroupedTier {
  threshold: number;
  severity: string;
  message: string;
}

/**
 * Mỗi "mốc ngưỡng cảnh báo" (VD "Xe đỗ quá lâu >=24h → Cảnh báo") thực chất là 1 ExpertRule
 * domain="alert" với đúng 1 điều kiện + 1 hành động severity — cùng nguồn dữ liệu với tab
 * "Cảnh báo nâng cao", chỉ khác giao diện: ở đây admin chọn loại/ngưỡng/mức độ qua dropdown
 * thay vì gõ JSON điều kiện/hành động tay. Đổi ở tab nào cũng phản ánh sang tab kia.
 */
function toTier(row: {
  id: number;
  conditions: string;
  actions: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: number | null;
}): AlertTier | null {
  try {
    const conditions = JSON.parse(row.conditions);
    const actions = JSON.parse(row.actions);
    const ruleType = conditions[0]?.fact;
    const threshold = conditions[0]?.value;
    const severity = actions[0]?.params?.severity;
    if (!ruleType || typeof threshold !== 'number' || !severity) return null;
    return {
      id: row.id,
      ruleType,
      threshold,
      severity,
      message: actions[0]?.params?.message ?? '',
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  } catch {
    return null;
  }
}

function tierCode(ruleType: string, threshold: number) {
  return `alert_${ruleType}_${threshold}`;
}

function tierLabel(ruleType: RuleType, threshold: number) {
  const meta = RULE_TYPES[ruleType];
  const op = meta.comparator === 'gte' ? '>=' : '<=';
  return `${meta.label} ${op} ${threshold}${meta.unit}`;
}

/**
 * Nội dung cảnh báo của mốc, sinh từ loại/ngưỡng/mức độ — {value} là chỗ trống cho giá trị đo
 * được lúc chạy. Lưu vào params.message để luật domain "alert" đủ field theo validate.
 */
function tierMessage(ruleType: RuleType, threshold: number, severity: string) {
  const meta = RULE_TYPES[ruleType];
  const op = meta.comparator === 'gte' ? '>=' : '<=';
  return `${meta.label}: giá trị {value} ${op} mốc ${threshold}${meta.unit} → mức ${severity}`;
}

function tierRuleData(data: TierSpec, updatedBy?: number) {
  const meta = RULE_TYPES[data.ruleType];
  const payload = {
    code: tierCode(data.ruleType, data.threshold),
    domain: 'alert',
    name: tierLabel(data.ruleType, data.threshold),
    priority: 100,
    conditions: [{ fact: data.ruleType, operator: meta.comparator, value: data.threshold }],
    actions: [
      {
        type: 'alert',
        params: { severity: data.severity, message: tierMessage(data.ruleType, data.threshold, data.severity) },
      },
    ],
  };
  // Đi qua đúng validate của domain "alert" như luật tạo tay qua API /expert-rules.
  validateRule(payload);
  return {
    code: payload.code,
    domain: payload.domain,
    name: payload.name,
    priority: payload.priority,
    conditions: JSON.stringify(payload.conditions),
    actions: JSON.stringify(payload.actions),
    updatedBy,
  };
}

class AlertRuleTierService {
  /** Bù params.message cho các mốc đã seed từ bản cũ (chỉ thêm khi thiếu) để luật qua được validate. */
  private async backfillMessages(rows: { id: number; conditions: string; actions: string }[]): Promise<void> {
    for (const row of rows) {
      try {
        const conditions = JSON.parse(row.conditions);
        const actions = JSON.parse(row.actions);
        const ruleType = conditions[0]?.fact as RuleType;
        const threshold = conditions[0]?.value;
        const severity = actions[0]?.params?.severity;
        if (!(ruleType in RULE_TYPES) || typeof threshold !== 'number' || !severity) continue;
        if (actions[0].params.message !== undefined) continue;
        actions[0].params.message = tierMessage(ruleType, threshold, severity);
        await prisma.expertRule.update({ where: { id: row.id }, data: { actions: JSON.stringify(actions) } });
      } catch {
        // Luật hỏng JSON — toTier() sẽ bỏ qua, không cần chặn cả danh sách.
      }
    }
  }

  /**
   * Toàn bộ mốc cho màn hình quản lý — trả về cả mốc đang bật và đang tắt (kèm cờ enabled),
   * seed mặc định nếu chưa có luật nào (lần chạy đầu).
   */
  async list(filters: { ruleType?: string; severity?: string } = {}): Promise<AlertTier[]> {
    const count = await prisma.expertRule.count({ where: { domain: 'alert' } });
    if (count === 0) {
      await prisma.expertRule.createMany({ data: DEFAULT_TIERS.map((t) => tierRuleData(t)) });
      await knowledgeBase.reload();
    }
    let rows = await prisma.expertRule.findMany({ where: { domain: 'alert' } });
    const needBackfill = rows.filter((r) => !r.actions.includes('"message"'));
    // Chạy đúng 1 lần rồi đọc lại — không gọi đệ quy, vì luật hỏng JSON sẽ mãi không có message.
    if (needBackfill.length > 0) {
      await this.backfillMessages(needBackfill);
      rows = await prisma.expertRule.findMany({ where: { domain: 'alert' } });
    }
    const tiers = rows.map(toTier).filter((t): t is AlertTier => t !== null);
    return tiers
      .filter((t) => (!filters.ruleType || t.ruleType === filters.ruleType) && (!filters.severity || t.severity === filters.severity))
      .sort((a, b) => a.ruleType.localeCompare(b.ruleType) || b.threshold - a.threshold);
  }

  /**
   * Mốc ĐANG BẬT, gộp theo ruleType — đây là đầu vào suy diễn cảnh báo của report.service.
   * Mốc bị tắt (enabled = false) không có ở đây nên không còn sinh cảnh báo nữa.
   */
  async getAllGrouped(): Promise<Record<string, GroupedTier[]>> {
    const tiers = (await this.list()).filter((t) => t.enabled);
    const grouped: Record<string, GroupedTier[]> = {};
    for (const t of tiers) {
      (grouped[t.ruleType] ??= []).push({ threshold: t.threshold, severity: t.severity, message: t.message });
    }
    return grouped;
  }

  private validate(ruleType: string, threshold: unknown, severity: string) {
    if (!(ruleType in RULE_TYPES)) {
      const err: any = new Error(`Loại cảnh báo không hợp lệ: ${ruleType}`);
      err.status = 400;
      throw err;
    }
    if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
      const err: any = new Error('Ngưỡng phải là số');
      err.status = 400;
      throw err;
    }
    if (!(VALID_SEVERITIES as readonly string[]).includes(severity)) {
      const err: any = new Error(`Mức độ không hợp lệ: ${severity}`);
      err.status = 400;
      throw err;
    }
  }

  async create(data: TierSpec, updatedBy?: number) {
    this.validate(data.ruleType, data.threshold, data.severity);
    const code = tierCode(data.ruleType, data.threshold);
    const existing = await prisma.expertRule.findUnique({ where: { code } });
    if (existing) {
      const err: any = new Error('Mốc ngưỡng này đã tồn tại cho loại cảnh báo này');
      err.status = 400;
      throw err;
    }
    const row = await prisma.expertRule.create({ data: tierRuleData(data, updatedBy) });
    await knowledgeBase.reload();
    return toTier(row);
  }

  async update(id: number, data: TierSpec & { enabled?: boolean }, updatedBy?: number) {
    this.validate(data.ruleType, data.threshold, data.severity);
    const code = tierCode(data.ruleType, data.threshold);
    const existing = await prisma.expertRule.findUnique({ where: { code } });
    if (existing && existing.id !== id) {
      const err: any = new Error('Mốc ngưỡng này đã tồn tại cho loại cảnh báo này');
      err.status = 400;
      throw err;
    }
    const { domain: _domain, priority: _priority, ...ruleData } = tierRuleData(data, updatedBy);
    const row = await prisma.expertRule.update({
      where: { id },
      data: {
        ...ruleData,
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
    await knowledgeBase.reload();
    return toTier(row);
  }

  async delete(id: number) {
    await prisma.expertRule.delete({ where: { id } });
    await knowledgeBase.reload();
  }

  /** Mốc khớp nhất với 1 giá trị đo được (mốc chặt nhất trước), hoặc null nếu dưới mọi mốc đang bật. */
  private matchTier(ruleType: RuleType, value: number, grouped: Record<string, GroupedTier[]>): GroupedTier | null {
    const tiers = grouped[ruleType] || [];
    if (tiers.length === 0) return null;
    const comparator = RULE_TYPES[ruleType].comparator;
    const sorted = [...tiers].sort((a, b) => (comparator === 'gte' ? b.threshold - a.threshold : a.threshold - b.threshold));
    for (const tier of sorted) {
      const matched = comparator === 'gte' ? value >= tier.threshold : value <= tier.threshold;
      if (matched) return tier;
    }
    return null;
  }

  /** So khớp 1 giá trị đo được với bảng mốc của 1 ruleType — trả về severity của mốc khớp nhất, hoặc null nếu dưới mọi mốc. */
  evaluate(ruleType: RuleType, value: number, grouped: Record<string, GroupedTier[]>): string | null {
    return this.matchTier(ruleType, value, grouped)?.severity ?? null;
  }

  /** Như evaluate(), nhưng kèm explanation lấy từ nội dung cảnh báo của luật — dùng khi cần hiển thị lý do. */
  evaluateWithExplanation(
    ruleType: RuleType,
    value: number,
    grouped: Record<string, GroupedTier[]>,
  ): { severity: string | null; explanation: string } {
    const tier = this.matchTier(ruleType, value, grouped);
    const meta = RULE_TYPES[ruleType];
    if (!tier) {
      return { severity: null, explanation: `${meta.label}: giá trị ${value} chưa vượt mốc nào đang bật` };
    }
    return { severity: tier.severity, explanation: renderMessage(tier.message, { value }) };
  }
}

export const alertRuleTierService = new AlertRuleTierService();
