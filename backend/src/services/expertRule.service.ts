import prisma from '../config/prisma';
import { knowledgeBase, inferenceEngine } from '../expertSystem';
import type { Condition, Action, Fact } from '../expertSystem';

const VALID_OPERATORS = ['gte', 'lte', 'gt', 'lt', 'eq', 'neq'];

interface ExpertRuleInput {
  code: string;
  domain: string;
  name: string;
  description?: string | null;
  priority?: number;
  conditions: Condition[];
  actions: Action[];
  enabled?: boolean;
}

class ExpertRuleService {
  async list(filters: { domain?: string; enabled?: boolean } = {}) {
    const rows = await prisma.expertRule.findMany({
      where: {
        ...(filters.domain && { domain: filters.domain }),
        ...(filters.enabled !== undefined && { enabled: filters.enabled }),
      },
      orderBy: [{ domain: 'asc' }, { priority: 'asc' }],
    });
    return rows.map((r) => ({
      ...r,
      conditions: JSON.parse(r.conditions),
      actions: JSON.parse(r.actions),
    }));
  }

  async domains(): Promise<string[]> {
    const rows = await prisma.expertRule.findMany({ select: { domain: true }, distinct: ['domain'] });
    return rows.map((r) => r.domain);
  }

  async getById(id: number) {
    const row = await prisma.expertRule.findUniqueOrThrow({ where: { id } });
    return { ...row, conditions: JSON.parse(row.conditions), actions: JSON.parse(row.actions) };
  }

  private validate(data: ExpertRuleInput) {
    if (!data.code?.trim()) {
      const err: any = new Error('Mã luật không được để trống');
      err.status = 400;
      throw err;
    }
    if (!data.domain?.trim()) {
      const err: any = new Error('Nhóm luật (domain) không được để trống');
      err.status = 400;
      throw err;
    }
    if (!Array.isArray(data.conditions) || data.conditions.length === 0) {
      const err: any = new Error('Cần ít nhất 1 điều kiện');
      err.status = 400;
      throw err;
    }
    for (const c of data.conditions) {
      if (!c.fact || !VALID_OPERATORS.includes(c.operator) || typeof c.value !== 'number') {
        const err: any = new Error('Điều kiện không hợp lệ');
        err.status = 400;
        throw err;
      }
    }
    if (!Array.isArray(data.actions) || data.actions.length === 0) {
      const err: any = new Error('Cần ít nhất 1 hành động');
      err.status = 400;
      throw err;
    }
  }

  async create(data: ExpertRuleInput, updatedBy?: number) {
    this.validate(data);
    const row = await prisma.expertRule.create({
      data: {
        code: data.code,
        domain: data.domain,
        name: data.name,
        description: data.description ?? null,
        priority: data.priority ?? 100,
        conditions: JSON.stringify(data.conditions),
        actions: JSON.stringify(data.actions),
        enabled: data.enabled ?? true,
        updatedBy,
      },
    });
    await knowledgeBase.reload();
    return row;
  }

  async update(id: number, data: ExpertRuleInput, updatedBy?: number) {
    this.validate(data);
    const row = await prisma.expertRule.update({
      where: { id },
      data: {
        code: data.code,
        domain: data.domain,
        name: data.name,
        description: data.description ?? null,
        priority: data.priority ?? 100,
        conditions: JSON.stringify(data.conditions),
        actions: JSON.stringify(data.actions),
        enabled: data.enabled ?? true,
        updatedBy,
      },
    });
    await knowledgeBase.reload();
    return row;
  }

  async delete(id: number) {
    await prisma.expertRule.delete({ where: { id } });
    await knowledgeBase.reload();
  }

  async evaluate(domain: string, facts: Fact) {
    return inferenceEngine.evaluate(facts, domain);
  }
}

export const expertRuleService = new ExpertRuleService();
