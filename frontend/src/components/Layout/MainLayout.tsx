import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown, MenuProps } from 'antd';
import {
  DashboardOutlined,
  CarOutlined,
  LoginOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  GiftOutlined,
  DollarOutlined,
  BarChartOutlined,
  SettingOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  AuditOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const menuItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: 'Tổng quan' },
    {
      key: 'parking',
      icon: <CarOutlined />,
      label: 'Quản lý ra vào',
      children: [
        { key: '/parking/entry', icon: <LoginOutlined />, label: 'Xe vào' },
        { key: '/parking/exit', icon: <LogoutOutlined />, label: 'Xe ra' },
        { key: '/parking/history', icon: <HistoryOutlined />, label: 'Lịch sử' },
      ],
    },
    { key: '/parking-spots', icon: <EnvironmentOutlined />, label: 'Bãi đỗ xe' },
    { key: '/customers', icon: <TeamOutlined />, label: 'Khách hàng' },
    { key: '/vehicles', icon: <CarOutlined />, label: 'Phương tiện' },
    { key: '/vehicle-types', icon: <AppstoreOutlined />, label: 'Loại xe' },
    {
      key: 'packages',
      icon: <GiftOutlined />,
      label: 'Gói dịch vụ',
      children: [
        { key: '/packages', label: 'Danh sách gói' },
        { key: '/customer-packages', label: 'Đăng ký gói' },
      ],
    },
    ...(isAdmin
      ? [
          { key: '/payments', icon: <DollarOutlined />, label: 'Thanh toán' },
          { key: '/alerts', icon: <AlertOutlined />, label: 'Cảnh báo' },
          { key: '/reports', icon: <BarChartOutlined />, label: 'Báo cáo' },
          { key: '/users', icon: <SettingOutlined />, label: 'Người dùng' },
          { key: '/activity-logs', icon: <AuditOutlined />, label: 'Nhật ký hoạt động' },
        ]
      : []),
  ];

  const userMenuItems: MenuProps['items'] = [

    { key: 'role', label: `Vai trò: ${user?.role === 'admin' ? 'Quản trị' : 'Nhân viên'}`, disabled: true },
    { type: 'divider' },
    { key: 'myprofile', label: 'Thông tin cá nhân', icon: <UserOutlined /> },
    { key: 'logout', label: 'Đăng xuất', danger: true, icon: <LogoutOutlined /> },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') logout();
    if (key === 'myprofile') navigate('/profile');
  };

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const initials = user?.fullName
    ? user.fullName.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : 'U';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">P</div>
          <span className="logo-text">PSM</span>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['parking', 'packages']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </aside>

      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--on-surface)' }}>Quản lý bãi đỗ xe</span>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums' }}>
            {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}{' — '}
            {currentTime.toLocaleTimeString('vi-VN')}
          </span>
        </div>
        <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight">
          <button className="user-header-btn" style={{ cursor: 'pointer' }}>
            <div className="user-avatar">{initials}</div>
            <span>{user?.fullName}</span>
          </button>
        </Dropdown>
      </header>

      {/* Content */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
