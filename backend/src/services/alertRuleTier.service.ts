import prisma from '../config/prisma';

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

/** Mốc mặc định — seed 1 lần khi bảng còn trống, giữ hành vi tương đương bản cũ trước khi có bảng tier. */
const DEFAULT_TIERS: { ruleType: RuleType; threshold: number; severity: string }[] = [
  { ruleType: 'zoneNearFullPercent', threshold: 10, severity: 'warning' },
  { ruleType: 'zoneImbalanceMaxPercent', threshold: 90, severity: 'warning' },
  { ruleType: 'longParkingHours', threshold: 24, severity: 'warning' },
  { ruleType: 'parkingAnomalyMultiplier', threshold: 3, severity: 'warning' },
  { ruleType: 'suspiciousPaymentAmount', threshold: 5000000, severity: 'warning' },
  { ruleType: 'revenueDropPercent', threshold: 30, severity: 'warning' },
  { ruleType: 'renewalFrequency', threshold: 5, severity: 'info' },
];

class AlertRuleTierService {
  /** Lấy toàn bộ mốc, seed mặc định nếu bảng trống (lần chạy đầu). */
  async list(filters: { ruleType?: string; severity?: string } = {}) {
    const count = await prisma.alertRuleTier.count();
    if (count === 0) {
      await prisma.alertRuleTier.createMany({ data: DEFAULT_TIERS });
    }
    return prisma.alertRuleTier.findMany({
      where: {
        ...(filters.ruleType && { ruleType: filters.ruleType }),
        ...(filters.severity && { severity: filters.severity }),
      },
      orderBy: [{ ruleType: 'asc' }, { threshold: 'desc' }],
    });
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

  async create(data: { ruleType: string; threshold: number; severity: string }, updatedBy?: number) {
    this.validate(data.ruleType, data.threshold, data.severity);
    return prisma.alertRuleTier.create({ data: { ...data, updatedBy } });
  }

  async update(id: number, data: { ruleType: string; threshold: number; severity: string }, updatedBy?: number) {
    this.validate(data.ruleType, data.threshold, data.severity);
    return prisma.alertRuleTier.update({ where: { id }, data: { ...data, updatedBy } });
  }

  async delete(id: number) {
    return prisma.alertRuleTier.delete({ where: { id } });
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
}

export const alertRuleTierService = new AlertRuleTierService();
