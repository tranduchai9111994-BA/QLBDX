import prisma from '../config/prisma';
import { knowledgeBase, inferenceEngine, validateRule, DOMAIN_FORM_SPEC } from '../expertSystem';
import type { Condition, Action, Fact } from '../expertSystem';

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

  /**
   * Khuôn form nhập luật cho màn hình quản trị — sinh từ cùng nguồn với validate
   * (expertSystem/domainSpecs.ts) nên dropdown trên UI luôn khớp giá trị hợp lệ ở backend.
   */
  formSpec() {
    return DOMAIN_FORM_SPEC;
  }

  async domains(): Promise<string[]> {
    const rows = await prisma.expertRule.findMany({ select: { domain: true }, distinct: ['domain'] });
    return rows.map((r) => r.domain);
  }

  async getById(id: number) {
    const row = await prisma.expertRule.findUniqueOrThrow({ where: { id } });
    return { ...row, conditions: JSON.parse(row.conditions), actions: JSON.parse(row.actions) };
  }

  /**
   * Validate chung + validate riêng theo domain (xem expertSystem/validation.ts) — luật thiếu
   * field mà service tiêu thụ cần sẽ bị chặn ngay lúc lưu, không lưu được rồi lúc chạy mới lỗi.
   */
  private validate(data: ExpertRuleInput) {
    validateRule(data);
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
