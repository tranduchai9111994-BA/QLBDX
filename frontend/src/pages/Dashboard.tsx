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

  if (!isAdmin) return <OpsDashboard />;

  return view === 'mgmt' ? <MgmtDashboard /> : <OpsDashboard />;
};

export default Dashboard;
