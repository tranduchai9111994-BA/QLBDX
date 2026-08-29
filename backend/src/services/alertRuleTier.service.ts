import prisma from '../config/prisma';
import { knowledgeBase } from '../expertSystem';

export const VALID_SEVERITIES = ['danger', 'warning', 'info'];

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

/** Mốc mặc định — seed 1 lần khi chưa có luật "alert" nào (cài đặt lần đầu, chưa từng chạy AlertRuleTier cũ). */
const DEFAULT_TIERS: { ruleType: RuleType; threshold: number; severity: string }[] = [
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
  createdAt: Date;
  updatedAt: Date;
  updatedBy: number | null;
}

/**
 * Mỗi "mốc ngưỡng cảnh báo" (VD "Xe đỗ quá lâu >=24h → Cảnh báo") thực chất là 1 ExpertRule
 * domain="alert" với đúng 1 điều kiện + 1 hành động severity — cùng nguồn dữ liệu với tab
 * "Cảnh báo nâng cao", chỉ khác giao diện: ở đây admin chọn loại/ngưỡng/mức độ qua dropdown
 * thay vì gõ JSON điều kiện/hành động tay. Đổi ở tab nào cũng phản ánh sang tab kia.
 */
function toTier(row: { id: number; conditions: string; actions: string; createdAt: Date; updatedAt: Date; updatedBy: number | null }): AlertTier | null {
  try {
    const conditions = JSON.parse(row.conditions);
    const actions = JSON.parse(row.actions);
    const ruleType = conditions[0]?.fact;
    const threshold = conditions[0]?.value;
    const severity = actions[0]?.params?.severity;
    if (!ruleType || typeof threshold !== 'number' || !severity) return null;
    return { id: row.id, ruleType, threshold, severity, createdAt: row.createdAt, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  } catch {
    return null;
  }
}

function tierCode(ruleType: string, threshold: number) {
  return `alert_${ruleType}_${threshold}`;
}

class AlertRuleTierService {
  /** Lấy toàn bộ mốc (đọc từ ExpertRule domain="alert"), seed mặc định nếu chưa có luật nào (lần chạy đầu). */
  async list(filters: { ruleType?: string; severity?: string } = {}): Promise<AlertTier[]> {
    const count = await prisma.expertRule.count({ where: { domain: 'alert' } });
    if (count === 0) {
      await prisma.expertRule.createMany({
        data: DEFAULT_TIERS.map((t) => ({
          code: tierCode(t.ruleType, t.threshold),
          domain: 'alert',
          name: `${RULE_TYPES[t.ruleType].label} ${RULE_TYPES[t.ruleType].comparator === 'gte' ? '>=' : '<='} ${t.threshold}${RULE_TYPES[t.ruleType].unit}`,
          priority: 100,
          conditions: JSON.stringify([{ fact: t.ruleType, operator: RULE_TYPES[t.ruleType].comparator, value: t.threshold }]),
          actions: JSON.stringify([{ type: 'alert', params: { severity: t.severity } }]),
        })),
      });
      await knowledgeBase.reload();
    }
    const rows = await prisma.expertRule.findMany({ where: { domain: 'alert' } });
    const tiers = rows.map(toTier).filter((t): t is AlertTier => t !== null);
    return tiers
      .filter((t) => (!filters.ruleType || t.ruleType === filters.ruleType) && (!filters.severity || t.severity === filters.severity))
      .sort((a, b) => a.ruleType.localeCompare(b.ruleType) || b.threshold - a.threshold);
  }

  /** Tất cả mốc, gộp theo ruleType — dùng nội bộ cho report.service tính severity. */
  async getAllGrouped(): Promise<Record<string, { threshold: number; severity: string }[]>> {
    const tiers = await this.list();
    const grouped: Record<string, { threshold: number; severity: string }[]> = {};
    for (const t of tiers) {
      (grouped[t.ruleType] ??= []).push({ threshold: t.threshold, severity: t.severity });
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
    if (!VALID_SEVERITIES.includes(severity)) {
      const err: any = new Error(`Mức độ không hợp lệ: ${severity}`);
      err.status = 400;
      throw err;
    }
  }

  async create(data: { ruleType: RuleType; threshold: number; severity: string }, updatedBy?: number) {
    this.validate(data.ruleType, data.threshold, data.severity);
    const meta = RULE_TYPES[data.ruleType];
    const code = tierCode(data.ruleType, data.threshold);
    const existing = await prisma.expertRule.findUnique({ where: { code } });
    if (existing) {
      const err: any = new Error('Mốc ngưỡng này đã tồn tại cho loại cảnh báo này');
      err.status = 400;
      throw err;
    }
    const row = await prisma.expertRule.create({
      data: {
        code,
        domain: 'alert',
        name: `${meta.label} ${meta.comparator === 'gte' ? '>=' : '<='} ${data.threshold}${meta.unit}`,
        priority: 100,
        conditions: JSON.stringify([{ fact: data.ruleType, operator: meta.comparator, value: data.threshold }]),
        actions: JSON.stringify([{ type: 'alert', params: { severity: data.severity } }]),
        updatedBy,
      },
    });
    await knowledgeBase.reload();
    return toTier(row);
  }

  async update(id: number, data: { ruleType: RuleType; threshold: number; severity: string }, updatedBy?: number) {
    this.validate(data.ruleType, data.threshold, data.severity);
    const meta = RULE_TYPES[data.ruleType];
    const code = tierCode(data.ruleType, data.threshold);
    const existing = await prisma.expertRule.findUnique({ where: { code } });
    if (existing && existing.id !== id) {
      const err: any = new Error('Mốc ngưỡng này đã tồn tại cho loại cảnh báo này');
      err.status = 400;
      throw err;
    }
    const row = await prisma.expertRule.update({
      where: { id },
      data: {
        code,
        name: `${meta.label} ${meta.comparator === 'gte' ? '>=' : '<='} ${data.threshold}${meta.unit}`,
        conditions: JSON.stringify([{ fact: data.ruleType, operator: meta.comparator, value: data.threshold }]),
        actions: JSON.stringify([{ type: 'alert', params: { severity: data.severity } }]),
        updatedBy,
      },
    });
    await knowledgeBase.reload();
    return toTier(row);
  }

  async delete(id: number) {
    await prisma.expertRule.delete({ where: { id } });
    await knowledgeBase.reload();
  }

  /** So khớp 1 giá trị đo được với bảng mốc của 1 ruleType — trả về severity của mốc khớp nhất, hoặc null nếu dưới mọi mốc. */
  evaluate(ruleType: RuleType, value: number, grouped: Record<string, { threshold: number; severity: string }[]>): string | null {
    const tiers = grouped[ruleType] || [];
    if (tiers.length === 0) return null;
    const comparator = RULE_TYPES[ruleType].comparator;
    const sorted = [...tiers].sort((a, b) => comparator === 'gte' ? b.threshold - a.threshold : a.threshold - b.threshold);
    for (const tier of sorted) {
      const matched = comparator === 'gte' ? value >= tier.threshold : value <= tier.threshold;
      if (matched) return tier.severity;
    }
    return null;
  }

  /** Như evaluate(), nhưng kèm explanation — dùng khi cần hiển thị lý do phát cảnh báo cho người dùng. */
  evaluateWithExplanation(
    ruleType: RuleType,
    value: number,
    grouped: Record<string, { threshold: number; severity: string }[]>,
  ): { severity: string | null; explanation: string } {
    const severity = this.evaluate(ruleType, value, grouped);
    const meta = RULE_TYPES[ruleType];
    const op = meta.comparator === 'gte' ? '>=' : '<=';
    const explanation = severity
      ? `${meta.label}: giá trị ${value} ${op} mốc đã cấu hình → ${severity}`
      : `${meta.label}: giá trị ${value} chưa vượt mốc nào đã cấu hình`;
    return { severity, explanation };
  }
}

export const alertRuleTierService = new AlertRuleTierService();
