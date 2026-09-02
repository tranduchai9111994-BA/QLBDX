/**
 * Hook quản lý bộ luật của hệ chuyên gia — cầu nối giữa ExpertRulesPanel và API /api/expert-rules.
 *
 * Gom toàn bộ việc gọi API (danh sách, thêm, sửa, bật/tắt, xoá, test luật) vào một chỗ, để
 * component giao diện chỉ lo hiển thị. Sau mỗi thao tác ghi đều tải lại danh sách nên màn hình
 * luôn khớp với dữ liệu trong cơ sở dữ liệu.
 */
import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

export interface RuleCondition {
  fact: string;
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq';
  value: number;
}

export interface RuleAction {
  type: string;
  params: Record<string, any>;
}

export interface ExpertRule {
  id: number;
  code: string;
  domain: string;
  name: string;
  description: string | null;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
  updatedAt?: string;
}

/** Khuôn form nhập luật do backend mô tả (expertSystem/domainSpecs.ts) — xem DOMAIN_FORM_SPEC. */
export interface RuleFormField {
  name: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'textarea';
  required: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  variables?: { name: string; description: string }[];
}

export interface DomainFormSpec {
  label: string;
  description: string;
  actionType: string;
  facts: { name: string; label: string; help?: string }[];
  fields: RuleFormField[];
}

export interface ExpertRuleInput {
  code: string;
  domain: string;
  name: string;
  description?: string | null;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

/**
 * Quản lý luật của hệ chuyên gia (Knowledge Base) — thay thế dần các if/else hardcode
 * bằng bộ luật có thể cấu hình qua UI, đọc/ghi qua API /expert-rules.
 */
export function useExpertRules() {
  const [rules, setRules] = useState<ExpertRule[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [formSpec, setFormSpec] = useState<Record<string, DomainFormSpec>>({});
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async (domain?: string) => {
    setLoading(true);
    try {
      const res = await api.get<ExpertRule[]>('/expert-rules', { params: { domain } });
      setRules(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    const res = await api.get<string[]>('/expert-rules/domains');
    setDomains(res.data);
  }, []);

  // Khuôn form lấy từ backend để dropdown trên UI luôn khớp với validate ở server —
  // thêm 1 loại gợi ý mới chỉ cần sửa domainSpecs.ts, không phải sửa 2 nơi.
  const fetchFormSpec = useCallback(async () => {
    const res = await api.get<Record<string, DomainFormSpec>>('/expert-rules/form-spec');
    setFormSpec(res.data);
  }, []);

  useEffect(() => { fetchRules(); fetchDomains(); fetchFormSpec(); }, [fetchRules, fetchDomains, fetchFormSpec]);

  const createRule = async (data: ExpertRuleInput) => {
    await api.post('/expert-rules', data);
    await fetchRules();
    await fetchDomains();
  };

  const updateRule = async (id: number, data: ExpertRuleInput) => {
    await api.put(`/expert-rules/${id}`, data);
    await fetchRules();
    await fetchDomains();
  };

  /**
   * Bật/tắt nhanh 1 luật (Switch trên bảng) — gọi PATCH chỉ gửi đúng cờ `enabled`.
   * Không dùng updateRule() cho việc này: PUT là full-replace nên phải gửi lại toàn bộ rule,
   * thừa dữ liệu và tạo cơ hội ghi đè nhầm nội dung luật chỉ vì muốn đổi 1 boolean.
   */
  const setRuleEnabled = async (id: number, enabled: boolean) => {
    await api.patch(`/expert-rules/${id}/enabled`, { enabled });
    await fetchRules();
  };

  const deleteRule = async (id: number) => {
    await api.delete(`/expert-rules/${id}`);
    await fetchRules();
  };

  const testEvaluate = async (domain: string, facts: Record<string, number>) => {
    const res = await api.post('/expert-rules/evaluate', { domain, facts });
    return res.data;
  };

  return { rules, domains, formSpec, loading, fetchRules, createRule, updateRule, setRuleEnabled, deleteRule, testEvaluate };
}
