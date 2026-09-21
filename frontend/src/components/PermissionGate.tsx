/**
 * Thành phần bọc quanh nút/khối cần giới hạn quyền — LỚP 1 trong ba lớp phân quyền.
 *
 * Ba lớp phân quyền của hệ thống (nhắc lại để đọc code không nhầm vai):
 *   Lớp 1 — ẨN GIAO DIỆN : file này + MainLayout.canSee()        -> chỉ để màn hình gọn
 *   Lớp 2 — CHẶN URL     : App.tsx (PrivateRoute/AdminRoute/...) -> chặn gõ URL trực tiếp
 *   Lớp 3 — CHẶN API     : backend/src/middlewares/requirePermission.ts  <- LỚP BẢO MẬT THẬT
 *
 * => File này KHÔNG phải là bảo mật. Ẩn nút chỉ làm người dùng khỏi bấm vào rồi mới bị báo lỗi;
 *    ai cũng có thể gọi thẳng API bằng Postman, và lúc đó lớp 3 mới là chỗ chặn.
 *
 * Vì sao gom vào một component: trước đây mỗi trang tự viết `user?.role === 'admin' && ...` rải
 * rác, sửa quy tắc phải sửa hàng chục chỗ. Giờ quy tắc nằm đúng một nơi.
 */
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

  // --- Bước 1: admin đi tắt. Admin toàn quyền nên không cần tra ma trận (khớp với cách
  // requirePermission.ts ở backend cũng cho admin bypass) ---
  if (isAdmin) return <>{children}</>;

  // --- Bước 2: khối chỉ dành cho admin mà người xem không phải admin -> ẩn ---
  if (adminOnly) return <>{fallback}</>;

  // --- Bước 3: tra ma trận quyền theo cặp (màn hình, hành động) ---
  if (screen && action) {
    const perm = (user?.permissions || []).find((p) => p.screenKey === screen);
    const allowed = perm && (action === 'create' ? perm.canCreate : action === 'update' ? perm.canUpdate : perm.canDelete);
    // Không tìm thấy dòng quyền -> `perm` là undefined -> `allowed` falsy -> ẨN.
    // Đây là nguyên tắc TỪ CHỐI MẶC ĐỊNH (deny-by-default): quên cấu hình thì đóng lại, chứ
    // không mở toang. Giống hệt cách backend xử lý, nên giao diện và API không nói ngược nhau.
    if (!allowed) return <>{fallback}</>;
  }

  // Không khai báo adminOnly lẫn (screen, action) -> coi như không giới hạn, hiện bình thường.
  return <>{children}</>;
};

export default PermissionGate;
