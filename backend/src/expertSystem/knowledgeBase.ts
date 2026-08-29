import prisma from '../config/prisma';
import type { Rule, Condition, Action } from './types';
import { DEFAULT_RULES } from './rules/defaults';

class KnowledgeBase {
  private rules: Rule[] = [];
  private loaded = false;

  async load(): Promise<void> {
    const count = await prisma.expertRule.count();
    if (count === 0) {
      await prisma.expertRule.createMany({ data: DEFAULT_RULES });
    }
    const rows = await prisma.expertRule.findMany({
      where: { enabled: true },
      orderBy: [{ domain: 'asc' }, { priority: 'asc' }],
    });
    this.rules = rows.map((r) => ({
      id: r.id,
      code: r.code,
      domain: r.domain,
      name: r.name,
      description: r.description,
      priority: r.priority,
      conditions: JSON.parse(r.conditions) as Condition[],
      actions: JSON.parse(r.actions) as Action[],
      enabled: r.enabled,
    }));
    this.loaded = true;
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();
  }

  async getRulesByDomain(domain: string): Promise<Rule[]> {
    await this.ensureLoaded();
    return this.rules.filter((r) => r.domain === domain);
  }

  async getAllRules(): Promise<Rule[]> {
    await this.ensureLoaded();
    return this.rules;
  }

  async reload(): Promise<void> {
    this.loaded = false;
    await this.load();
  }
}

export const knowledgeBase = new KnowledgeBase();
