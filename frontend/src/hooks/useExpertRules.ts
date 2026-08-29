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

  useEffect(() => { fetchRules(); fetchDomains(); }, [fetchRules, fetchDomains]);

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

  const deleteRule = async (id: number) => {
    await api.delete(`/expert-rules/${id}`);
    await fetchRules();
  };

  const testEvaluate = async (domain: string, facts: Record<string, number>) => {
    const res = await api.post('/expert-rules/evaluate', { domain, facts });
    return res.data;
  };

  return { rules, domains, loading, fetchRules, createRule, updateRule, deleteRule, testEvaluate };
}
