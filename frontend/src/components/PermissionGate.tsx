import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export type PermissionAction = 'create' | 'update' | 'delete';

interface PermissionGateProps {
  /** Chỉ admin mới thấy nội dung bên trong (dùng cho hành động không có trong ma trận nhóm quyền,
   * VD trang Người dùng/Nhật ký hoạt động). */
  adminOnly?: boolean;
  /** Cặp (screen, action) tra theo ma trận nhóm quyền — VD screen="vehicles" action="delete" chỉ
   * hiện nếu admin, hoặc staff thuộc nhóm được cấp quyền Xóa trên màn Phương tiện. */
  screen?: string;
  action?: PermissionAction;
  /** Nội dung thay thế khi không đủ quyền — mặc định không hiển thị gì */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Bọc quanh nút/khối nội dung cần giới hạn quyền, thay cho việc check `isAdmin`/quyền rải rác
 * từng trang. Nguồn dữ liệu quyền là `user.permissions` (trả về từ /auth/me, đọc từ bảng
 * GroupPermission ở backend) — admin luôn qua, không cần khai báo gì thêm. */
const PermissionGate: React.FC<PermissionGateProps> = ({ adminOnly, screen, action, fallback = null, children }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (isAdmin) return <>{children}</>;
  if (adminOnly) return <>{fallback}</>;

  if (screen && action) {
    const perm = (user?.permissions || []).find((p) => p.screenKey === screen);
    const allowed = perm && (action === 'create' ? perm.canCreate : action === 'update' ? perm.canUpdate : perm.canDelete);
    if (!allowed) return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;
