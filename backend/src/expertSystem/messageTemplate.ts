/**
 * Nội dung gợi ý/cảnh báo được lưu trong chính luật (action.params.message) dưới dạng mẫu có
 * chỗ trống {tenBien}, số liệu thật do service điền vào lúc chạy. Nhờ vậy admin sửa được câu chữ
 * của gợi ý ngay trên màn hình quản lý luật mà không cần build lại backend.
 */
export function renderMessage(template: unknown, vars: Record<string, string | number> = {}): string {
  if (typeof template !== 'string' || !template.trim()) return '';
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    vars[key] === undefined ? whole : String(vars[key]),
  );
}
