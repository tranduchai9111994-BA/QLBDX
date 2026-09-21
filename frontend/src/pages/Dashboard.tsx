/**
 * Màn hình TỔNG QUAN — thực chất chỉ là BỘ CHIA ĐƯỜNG, không tự vẽ gì.
 *
 * Vì sao tách thành hai dashboard riêng thay vì một trang có nhiều if:
 *   - Nhân viên cần số liệu ĐANG DIỄN RA để làm việc (xe trong bãi, chỗ trống)  -> OpsDashboard
 *   - Quản trị cần số liệu TỔNG HỢP để ra quyết định (doanh thu, xu hướng)      -> MgmtDashboard
 * Hai nhu cầu khác nhau hẳn nên tách file, mỗi file tự gọi API của mình.
 *
 * Luồng: MainLayout (toggle ở header) -> DashboardViewContext -> file này đọc `view` -> render.
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardView } from '../context/DashboardViewContext';
import OpsDashboard from './dashboard/OpsDashboard';
import MgmtDashboard from './dashboard/MgmtDashboard';

/** Router theo vai trò — Quản trị mặc định xem MgmtDashboard, có thể chuyển sang view Vận hành qua
 * toggle đặt ở header (MainLayout), xem DashboardViewContext. */
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { view } = useDashboardView();

  // Nhân viên KHÔNG có lựa chọn: luôn là dashboard vận hành. Chặn ở đây trước khi đọc `view`
  // để nhân viên không thể xem dashboard quản trị kể cả khi context còn giá trị 'mgmt' sót lại
  // trong localStorage từ phiên của admin trước đó trên cùng máy.
  if (!isAdmin) return <OpsDashboard />;

  // Admin: mặc định xem bản quản trị, nhưng chuyển được sang bản vận hành để kiểm tra xem
  // nhân viên đang thấy gì.
  return view === 'mgmt' ? <MgmtDashboard /> : <OpsDashboard />;
};

export default Dashboard;
