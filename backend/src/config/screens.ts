/**
 * Danh mục "màn hình/chức năng" mà nhóm quyền có thể cấu hình — nguồn dữ liệu DUY NHẤT cho cả
 * middleware chặn API (requirePermission) lẫn UI ma trận phân quyền (permission-groups routes trả
 * danh sách này về cho frontend render, không hardcode riêng ở frontend nữa).
 *
 * Đây là 9/16 màn hình trong permConfig.ts (frontend) có configurable=true — các màn còn lại
 * (Tổng quan, Xe vào/ra/Lịch sử, Phân tích, Người dùng, Nhật ký) không đổi theo nhóm quyền: staff
 * luôn full các màn vận hành cốt lõi, còn lại admin-only — giữ nguyên logic cũ, không qua group.
 */
export interface ScreenDef {
  key: string;
  label: string;
  group: string;
}

export const CONFIGURABLE_SCREENS: ScreenDef[] = [
  { key: 'parking-spots', label: 'Bãi đỗ xe', group: 'Hạ tầng' },
  { key: 'customers', label: 'Khách hàng', group: 'Nghiệp vụ' },
  { key: 'vehicles', label: 'Phương tiện', group: 'Nghiệp vụ' },
  { key: 'customer-packages', label: 'Đăng ký gói', group: 'Nghiệp vụ' },
  { key: 'vehicle-types', label: 'Loại xe', group: 'Danh mục' },
  { key: 'packages', label: 'Gói dịch vụ', group: 'Danh mục' },
  { key: 'payments', label: 'Thanh toán', group: 'Quản trị' },
  { key: 'alerts', label: 'Cảnh báo', group: 'Quản trị' },
  { key: 'reports', label: 'Báo cáo thống kê', group: 'Quản trị' },
];

export const CONFIGURABLE_SCREEN_KEYS = CONFIGURABLE_SCREENS.map((s) => s.key);
