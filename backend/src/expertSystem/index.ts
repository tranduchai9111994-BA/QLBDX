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
} from './domainSpecs';
export type { RuleType } from './domainSpecs';

export async function evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
  return inferenceEngine.evaluate(facts, domain);
}

export async function reload(): Promise<void> {
  return knowledgeBase.reload();
}
