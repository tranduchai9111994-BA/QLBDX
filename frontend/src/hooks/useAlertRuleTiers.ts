/**
 * Hook tải cấu hình mức độ cảnh báo từ /api/alert-rule-tiers.
 *
 * Nhờ hook này mà giao diện tô màu cảnh báo theo ĐÚNG ngưỡng admin đã cấu hình, thay vì viết cứng
 * "quá 24 giờ thì đỏ" trong mã nguồn.
 */
import { useEffect, useState } from 'react';
import api from '../api/axios';

interface RuleTier {
  ruleType: string;
  threshold: number;
  severity: string;
  enabled?: boolean;
}

// Chiều so sánh cố định theo từng loại — khớp với backend (alertRuleTier.service.ts RULE_TYPES).
const COMPARATOR: Record<string, 'gte' | 'lte'> = {
  zoneNearFullPercent: 'lte',
  zoneImbalanceMaxPercent: 'gte',
  longParkingHours: 'gte',
  parkingAnomalyMultiplier: 'gte',
  suspiciousPaymentAmount: 'gte',
  revenueDropPercent: 'gte',
  renewalFrequency: 'gte',
};

/**
 * Đọc bảng ngưỡng cảnh báo (đã cấu hình ở Cảnh báo → Cấu hình mức độ) để tô màu/đánh dấu
 * đúng theo mức độ thật admin đã đặt, thay vì hardcode 1 con số riêng ở từng trang.
 */
export function useAlertRuleTiers() {
  const [grouped, setGrouped] = useState<Record<string, RuleTier[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<RuleTier[]>('/alert-rule-tiers')
      .then((res) => {
        const g: Record<string, RuleTier[]> = {};
        // Chỉ mốc đang bật mới dùng để tô màu/đánh dấu — khớp với Inference Engine ở backend.
        res.data.filter((t) => t.enabled !== false).forEach((t) => { (g[t.ruleType] ??= []).push(t); });
        setGrouped(g);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /** Trả về severity ('danger'|'warning'|'info') của mốc khớp nhất, hoặc null nếu dưới mọi mốc / chưa cấu hình. */
  const evaluate = (ruleType: string, value: number): string | null => {
    const tiers = grouped[ruleType];
    if (!tiers || tiers.length === 0) return null;
    const comparator = COMPARATOR[ruleType] || 'gte';
    const sorted = [...tiers].sort((a, b) => comparator === 'gte' ? b.threshold - a.threshold : a.threshold - b.threshold);
    for (const tier of sorted) {
      const matched = comparator === 'gte' ? value >= tier.threshold : value <= tier.threshold;
      if (matched) return tier.severity;
    }
    return null;
  };

  return { evaluate, loaded };
}
