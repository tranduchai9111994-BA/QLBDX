import type { Condition, Fact, Rule, RuleResult, EvaluationResult } from './types';
import { knowledgeBase } from './knowledgeBase';

const OPERATOR_LABELS: Record<string, string> = {
  gte: '>=', lte: '<=', gt: '>', lt: '<', eq: '==', neq: '!=',
};

function evaluateCondition(condition: Condition, facts: Fact): { matched: boolean; explanation: string } {
  const actual = facts[condition.fact];
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

function evaluateRule(rule: Rule, facts: Fact): RuleResult {
  const condResults = rule.conditions.map((c) => evaluateCondition(c, facts));
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

class InferenceEngine {
  async evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
    const rules = await knowledgeBase.getRulesByDomain(domain);
    const results = rules.map((r) => evaluateRule(r, facts));
    const firedRules = results.filter((r) => r.matched);
    return {
      results,
      firedRules,
      explanations: firedRules.map((r) => r.explanation),
    };
  }
}

export const inferenceEngine = new InferenceEngine();
