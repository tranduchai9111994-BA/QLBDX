import { knowledgeBase } from './knowledgeBase';
import { inferenceEngine } from './inferenceEngine';
import type { Fact, EvaluationResult } from './types';

export { knowledgeBase } from './knowledgeBase';
export { inferenceEngine } from './inferenceEngine';
export type { Condition, Action, Fact, Rule, RuleResult, EvaluationResult } from './types';

export async function evaluate(facts: Fact, domain: string): Promise<EvaluationResult> {
  return inferenceEngine.evaluate(facts, domain);
}

export async function reload(): Promise<void> {
  return knowledgeBase.reload();
}
