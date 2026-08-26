import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { loadStaffPerms } from '../utils/permConfig';

interface PermissionGateProps {
  /** Chỉ admin mới thấy nội dung bên trong (thay cho `user?.role === 'admin' && ...` viết tay) */
  adminOnly?: boolean;
  /** Yêu cầu quyền 'full' trên 1 màn hình theo permConfig — staff ở mức 'view'/'hidden' sẽ không thấy nội dung */
  screen?: string;
  /** Nội dung thay thế khi không đủ quyền — mặc định không hiển thị gì */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Bọc quanh nút/khối nội dung cần giới hạn quyền, thay cho việc check `isAdmin`/`canSee` rải rác từng trang. */
const PermissionGate: React.FC<PermissionGateProps> = ({ adminOnly, screen, fallback = null, children }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (isAdmin) return <>{children}</>;
  if (adminOnly) return <>{fallback}</>;

  if (screen) {
    const perms = loadStaffPerms();
    if (perms[screen] !== 'full') return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;
