import React, { useState } from 'react';
import { Segmented } from 'antd';
import { useAuth } from '../context/AuthContext';
import OpsDashboard from './dashboard/OpsDashboard';
import MgmtDashboard from './dashboard/MgmtDashboard';

const VIEW_STORAGE_KEY = 'dashboard-admin-view';
type AdminView = 'mgmt' | 'ops';

/** Router theo vai trò — Quản trị mặc định xem MgmtDashboard, có thể chuyển sang view Vận hành. */
const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [view, setView] = useState<AdminView>(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === 'ops' ? 'ops' : 'mgmt';
  });

  if (!isAdmin) return <OpsDashboard />;

  const handleChange = (v: AdminView) => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Segmented
          value={view}
          onChange={(v) => handleChange(v as AdminView)}
          options={[
            { label: 'Quản lý', value: 'mgmt' },
            { label: 'Vận hành', value: 'ops' },
          ]}
        />
      </div>
      {view === 'mgmt' ? <MgmtDashboard /> : <OpsDashboard />}
    </div>
  );
};

export default Dashboard;
