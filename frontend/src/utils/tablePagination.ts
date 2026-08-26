import type { TablePaginationConfig } from 'antd/es/table';

/**
 * Cấu hình phân trang dùng chung — luôn cho chọn page size (10/20/30/50/100) và
 * gõ số để nhảy trang, thay vì mỗi trang tự khai báo `pagination={{ pageSize: N }}` cố định.
 */
export function defaultPagination(overrides: TablePaginationConfig = {}): TablePaginationConfig {
  return {
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '30', '50', '100'],
    showQuickJumper: true,
    showTotal: (total) => `${total.toLocaleString('vi-VN')} bản ghi`,
    ...overrides,
  };
}
