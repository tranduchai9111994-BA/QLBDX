import type { Action, Condition } from './types';
import {
  ANALYTICS_DECISION_IDS,
  DOMAIN_ACTION_TYPE,
  PACKAGE_LEVELS,
  REPORT_SUGGESTION_TYPES,
  RULE_TYPES,
  VALID_SEVERITIES,
} from './domainSpecs';

const VALID_OPERATORS = ['gte', 'lte', 'gt', 'lt', 'eq', 'neq'];

export function ruleError(message: string): Error & { status: number } {
  const err: any = new Error(message);
  err.status = 400;
  return err;
}

function requireText(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw ruleError(message);
  return value;
}

function requireOneOf(value: unknown, allowed: readonly string[], label: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw ruleError(`${label} không hợp lệ: "${String(value)}". Hệ thống chỉ xử lý được: ${allowed.join(', ')}`);
  }
}

/** Kiểm tra phần chung mọi luật đều phải có: mã, nhóm, điều kiện, hành động. */
function validateShape(data: { code?: string; domain?: string; conditions: Condition[]; actions: Action[] }) {
  if (!data.code?.trim()) throw ruleError('Mã luật không được để trống');
  if (!data.domain?.trim()) throw ruleError('Nhóm luật (domain) không được để trống');

  if (!Array.isArray(data.conditions) || data.conditions.length === 0) {
    throw ruleError('Cần ít nhất 1 điều kiện');
  }
  for (const c of data.conditions) {
    if (!c?.fact?.trim()) throw ruleError('Điều kiện phải có tên dữ kiện (fact)');
    if (!VALID_OPERATORS.includes(c.operator)) {
      throw ruleError(`Toán tử không hợp lệ: "${String(c.operator)}". Chỉ dùng: ${VALID_OPERATORS.join(', ')}`);
    }
    if (typeof c.value !== 'number' || Number.isNaN(c.value)) {
      throw ruleError(`Ngưỡng của điều kiện "${c.fact}" phải là số`);
    }
  }

  if (!Array.isArray(data.actions) || data.actions.length === 0) {
    throw ruleError('Cần ít nhất 1 hành động');
  }
  for (const a of data.actions) {
    if (!a?.type?.trim()) throw ruleError('Hành động phải có loại (type)');
    if (a.params === null || typeof a.params !== 'object' || Array.isArray(a.params)) {
      throw ruleError(`Hành động "${a.type}" phải có params dạng object`);
    }
  }
}

/**
 * Mỗi domain đòi hỏi params khác nhau vì service tiêu thụ luật đọc những field khác nhau.
 * Validate tại đây để luật thiếu field bị chặn ngay lúc lưu, thay vì lưu được rồi lúc chạy
 * mới sinh gợi ý rỗng / lỗi undefined.
 */
const DOMAIN_VALIDATORS: Record<string, (params: Record<string, any>, conditions: Condition[]) => void> = {
  // Gợi ý gói dịch vụ — customerPackage.service.ts cần package + durationDays để tra gói, savings để hiển thị.
  package(params) {
    requireOneOf(params.package, PACKAGE_LEVELS, 'Mức gói (params.package)');
    if (typeof params.durationDays !== 'number' || params.durationDays <= 0) {
      throw ruleError('Luật gợi ý gói phải có params.durationDays là số ngày > 0');
    }
    if (params.savings === undefined || params.savings === null || params.savings === '') {
      throw ruleError('Luật gợi ý gói phải có params.savings (mức tiết kiệm, VD "~20%")');
    }
  },

  // Cảnh báo — report.service.ts dùng severity để xếp mức độ; message/title là nội dung cảnh báo.
  alert(params, conditions) {
    if (!params.message && !params.title) {
      throw ruleError('Luật cảnh báo phải có params.message hoặc params.title');
    }
    requireOneOf(params.severity, VALID_SEVERITIES, 'Mức độ cảnh báo (params.severity)');
    for (const c of conditions) {
      requireOneOf(c.fact, Object.keys(RULE_TYPES), 'Loại cảnh báo (điều kiện fact)');
    }
  },

  // Hỗ trợ quyết định — analytics.service.ts tra khối phân tích theo params.id.
  analytics(params) {
    requireOneOf(params.id, ANALYTICS_DECISION_IDS, 'Mã quyết định (params.id)');
    if (!params.message && !params.recommendation) {
      throw ruleError('Luật hỗ trợ quyết định phải có params.message hoặc params.recommendation');
    }
  },

  // Gợi ý báo cáo — report.service.ts hiển thị theo params.type, nội dung lấy từ params.message.
  report(params) {
    requireOneOf(params.type, REPORT_SUGGESTION_TYPES, 'Loại gợi ý (params.type)');
    requireText(params.message, 'Luật gợi ý báo cáo phải có params.message');
  },
};

export function validateRule(data: {
  code?: string;
  domain?: string;
  conditions: Condition[];
  actions: Action[];
}): void {
  validateShape(data);

  const domain = data.domain!.trim();
  const expectedType = DOMAIN_ACTION_TYPE[domain];
  const validator = DOMAIN_VALIDATORS[domain];
  // Domain lạ (admin tự thêm nhóm mới) chỉ cần đúng phần chung — chưa có service nào tiêu thụ nên
  // không thể biết params phải gồm những gì.
  if (!expectedType || !validator) return;

  for (const action of data.actions) {
    if (action.type !== expectedType) {
      throw ruleError(`Luật nhóm "${domain}" phải dùng hành động type = "${expectedType}" (đang là "${action.type}")`);
    }
    validator(action.params, data.conditions);
  }
}
