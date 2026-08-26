/**
 * routeMeta.ts — map route → {title, group} dùng cho <PageHeader> (breadcrumb + tiêu đề chuẩn hoá).
 * UIUX plan T-03. Bổ sung dần khi từng trang chuyển sang dùng PageHeader.
 */
export interface RouteMeta {
  title: string;
  group: 'Vận hành' | 'Danh mục' | 'Quản trị' | null;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': { title: 'Tổng quan', group: null },
  '/parking/entry': { title: 'Xe vào', group: 'Vận hành' },
  '/parking/exit': { title: 'Xe ra', group: 'Vận hành' },
  '/parking/history': { title: 'Lịch sử', group: 'Vận hành' },
  '/parking-spots': { title: 'Bãi đỗ xe', group: 'Danh mục' },
  '/customers': { title: 'Khách hàng', group: 'Danh mục' },
  '/vehicles': { title: 'Phương tiện', group: 'Danh mục' },
  '/vehicle-types': { title: 'Loại xe', group: 'Danh mục' },
  '/packages': { title: 'Gói dịch vụ', group: 'Danh mục' },
  '/customer-packages': { title: 'Đăng ký gói', group: 'Danh mục' },
  '/payments': { title: 'Thanh toán', group: 'Quản trị' },
  '/alerts': { title: 'Cảnh báo', group: 'Quản trị' },
  '/reports': { title: 'Báo cáo', group: 'Quản trị' },
  '/analytics': { title: 'Phân tích & Gợi ý', group: 'Quản trị' },
  '/users': { title: 'Người dùng', group: 'Quản trị' },
  '/activity-logs': { title: 'Nhật ký hoạt động', group: 'Quản trị' },
  '/profile': { title: 'Hồ sơ cá nhân', group: null },
};
