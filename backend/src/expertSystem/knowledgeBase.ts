import prisma from '../config/prisma';
import type { Rule, Condition, Action } from './types';
import { DEFAULT_RULES } from './rules/defaults';

class KnowledgeBase {
  private rules: Rule[] = [];
  private loaded = false;

  /**
   * Nạp các luật mặc định còn thiếu, so theo mã luật (không so tổng số dòng của bảng — vì bảng
   * còn chứa luật domain "alert" do tab Cấu hình mức độ tự seed, nếu chỉ đếm count thì bộ luật
   * package/analytics/report sẽ không bao giờ được nạp).
   *
   * Đồng thời bù field params.message cho luật đã seed từ bản cũ (chỉ thêm khi thiếu, không ghi
   * đè nội dung admin đã sửa) để luật cũ vẫn qua được validate theo domain.
   */
  private async syncDefaults(): Promise<void> {
    const existing = await prisma.expertRule.findMany({
      where: { code: { in: DEFAULT_RULES.map((r) => r.code) } },
      select: { id: true, code: true, actions: true },
    });
    const byCode = new Map(existing.map((r) => [r.code, r]));

    const missing = DEFAULT_RULES.filter((r) => !byCode.has(r.code));
    if (missing.length > 0) {
      await prisma.expertRule.createMany({ data: missing });
    }

    for (const def of DEFAULT_RULES) {
      const row = byCode.get(def.code);
      if (!row) continue;
      const defActions = JSON.parse(def.actions) as Action[];
      let current: Action[];
      try {
        current = JSON.parse(row.actions) as Action[];
      } catch {
        continue;
      }
      let changed = false;
      current.forEach((action, i) => {
        if (!action?.params) return;
        const defMessage = defActions[i]?.params?.message;
        if (defMessage && action.params.message === undefined) {
          action.params.message = defMessage;
          changed = true;
        }
        // "template" là field thừa của bản đầu: được ghi vào DB nhưng không service nào đọc tới.
        // Dọn luôn cho dữ liệu khớp với code, tránh gây hiểu nhầm khi admin xem luật.
        if ('template' in action.params) {
          delete action.params.template;
          changed = true;
        }
      });
      if (changed) {
        await prisma.expertRule.update({ where: { id: row.id }, data: { actions: JSON.stringify(current) } });
      }
    }
  }

  async load(): Promise<void> {
    await this.syncDefaults();
    // Chỉ luật đang bật được nạp vào Inference Engine — tắt 1 luật là nó không còn sinh
    // gợi ý/cảnh báo/quyết định nào nữa. Màn hình quản lý luật đọc qua expertRuleService.list()
    // nên vẫn thấy đủ cả luật bật và tắt.
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

  /** Luật đang bật của 1 domain — đây là nguồn duy nhất Inference Engine được phép dùng. */
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
