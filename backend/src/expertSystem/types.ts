export interface Condition {
  fact: string;
  operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq';
  value: number;
}

export interface Action {
  type: string;
  params: Record<string, any>;
}

export type Fact = Record<string, number | string | boolean>;

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

export interface RuleResult {
  rule: Rule;
  matched: boolean;
  explanation: string;
  actionOutputs: Action[];
}

export interface EvaluationResult {
  results: RuleResult[];
  firedRules: RuleResult[];
  explanations: string[];
}
