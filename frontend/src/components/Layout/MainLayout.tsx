import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown, MenuProps, Segmented, Tooltip, Button, Badge } from 'antd';
import {
  DashboardOutlined, CarOutlined, LoginOutlined, LogoutOutlined,
  UserOutlined, TeamOutlined, EnvironmentOutlined, GiftOutlined,
  DollarOutlined, BarChartOutlined, SettingOutlined, HistoryOutlined,
  AppstoreOutlined, AuditOutlined, AlertOutlined, FundOutlined,
  SyncOutlined, MoonOutlined, SunOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { DashboardViewProvider, useDashboardView } from '../../context/DashboardViewContext';
import { useUpdateAvailable } from '../../hooks/useUpdateAvailable';
import DesktopOnlyBanner from './DesktopOnlyBanner';

// Màn nằm trong ma trận Nhóm quyền (backend) — staff thấy được khi nhóm của họ có ít nhất 1 dòng
// GroupPermission cho đúng key này (nghĩa là admin đã cấp Thêm/Sửa/Xóa nào đó). Khác các màn dưới
// (Tổng quan/Xe vào/Xe ra/Lịch sử) vốn luôn full cho staff, không qua nhóm quyền.
const CONFIGURABLE_KEYS = new Set([
  'parking-spots', 'customers', 'vehicles', 'vehicle-types',
  'packages', 'customer-packages', 'payments', 'alerts', 'reports',
]);
const ALWAYS_STAFF_KEYS = new Set(['dashboard', 'parking-entry', 'parking-exit', 'parking-history']);

const MainLayoutInner: React.FC = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const { updateAvailable, reload } = useUpdateAvailable();
  const { mode, toggleMode } = useTheme();
  const { view, setView } = useDashboardView();
  const showDashboardViewToggle = isAdmin && location.pathname === '/';

  const canSee = (key: string) => {
    if (isAdmin) return true;
    if (ALWAYS_STAFF_KEYS.has(key)) return true;
    if (CONFIGURABLE_KEYS.has(key)) return (user?.permissions || []).some((p) => p.screenKey === key);
    return false; // users / activity-logs / analytics -> admin only
  };

  const operationsGroup: MenuProps['items'] = [
    {
      key: 'parking',
      icon: <CarOutlined />,
      label: t('menuParkingManage'),
      children: [
        canSee('parking-entry')   ? { key: '/parking/entry',   icon: <LoginOutlined />,   label: t('menuParkingEntry') }   : null,
        canSee('parking-exit')    ? { key: '/parking/exit',    icon: <LogoutOutlined />,  label: t('menuParkingExit') }    : null,
        canSee('parking-history') ? { key: '/parking/history', icon: <HistoryOutlined />, label: t('menuParkingHistory') } : null,
      ].filter(Boolean) as MenuProps['items'],
    },
    canSee('payments') ? { key: '/payments', icon: <DollarOutlined />, label: t('menuPayments') } : null,
    canSee('alerts')   ? { key: '/alerts',   icon: <AlertOutlined />,  label: t('menuAlerts') }   : null,
  ].filter(Boolean) as MenuProps['items'];

  const catalogGroup: MenuProps['items'] = [
    canSee('parking-spots') ? { key: '/parking-spots', icon: <EnvironmentOutlined />, label: t('menuParkingSpots') } : null,
    canSee('customers')     ? { key: '/customers',      icon: <TeamOutlined />,        label: t('menuCustomers') }    : null,
    canSee('vehicles')      ? { key: '/vehicles',       icon: <CarOutlined />,         label: t('menuVehicles') }     : null,
    canSee('vehicle-types') ? { key: '/vehicle-types',  icon: <AppstoreOutlined />,    label: t('menuVehicleTypes') } : null,
    (canSee('packages') || canSee('customer-packages'))
      ? {
          key: 'packages',
          icon: <GiftOutlined />,
          label: t('menuPackages'),
          children: [
            canSee('packages')          ? { key: '/packages',          label: t('menuPackageList') }      : null,
            canSee('customer-packages') ? { key: '/customer-packages', label: t('menuCustomerPackages') } : null,
          ].filter(Boolean) as MenuProps['items'],
        }
      : null,
  ].filter(Boolean) as MenuProps['items'];

  const adminGroup: MenuProps['items'] = [
    canSee('reports') ? { key: '/reports', icon: <BarChartOutlined />, label: t('menuReports') } : null,
    isAdmin ? { key: '/analytics',     icon: <FundOutlined />,    label: t('menuAnalytics') }    : null,
    isAdmin ? { key: '/users',         icon: <SettingOutlined />, label: t('menuUsers') }         : null,
    isAdmin ? { key: '/activity-logs', icon: <AuditOutlined />,   label: t('menuActivityLogs') }  : null,
  ].filter(Boolean) as MenuProps['items'];

  // Nhóm menu là submenu thường (không phải type:'group') để có thể thu gọn/mở ra như Quản lý ra vào/Gói dịch vụ
  const menuItems: MenuProps['items'] = [
    canSee('dashboard') ? { key: '/', icon: <DashboardOutlined />, label: t('menuDashboard') } : null,
    operationsGroup.length ? { key: 'grp-ops', icon: <CarOutlined />, label: t('menuGroupOps'), children: operationsGroup } : null,
    catalogGroup.length ? { key: 'grp-catalog', icon: <AppstoreOutlined />, label: t('menuGroupCatalog'), children: catalogGroup } : null,
    adminGroup.length ? { key: 'grp-admin', icon: <SettingOutlined />, label: t('menuGroupAdmin'), children: adminGroup } : null,
  ].filter(Boolean) as MenuProps['items'];

  const OPEN_KEYS_STORAGE = 'qlbdx_sidebar_open_keys_v1';
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(OPEN_KEYS_STORAGE);
      if (raw) return JSON.parse(raw);
    } catch {}
    return ['grp-ops', 'grp-catalog', 'grp-admin', 'parking', 'packages'];
  });

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
    localStorage.setItem(OPEN_KEYS_STORAGE, JSON.stringify(keys));
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'role', label: `${t('userRole')}: ${user?.role === 'admin' ? t('userRoleAdmin') : t('userRoleStaff')}`, disabled: true },
    { type: 'divider' },
    { key: 'myprofile', label: t('myProfile'), icon: <UserOutlined /> },
    { key: 'logout', label: t('logout'), danger: true, icon: <LogoutOutlined /> },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') logout();
    if (key === 'myprofile') navigate('/profile');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()
    : 'U';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      <DesktopOnlyBanner />
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <img className="logo-icon" src="/logo192.png" alt="" />
          <span className="logo-text">{t('appShort')}</span>
        </div>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </aside>

      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--on-surface)' }}>
            {t('appName')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Toggle view Quản lý/Vận hành của trang Tổng quan — chỉ hiện khi admin đang ở trang này */}
          {showDashboardViewToggle && (
            <Segmented
              value={view}
              onChange={(v) => setView(v as 'mgmt' | 'ops')}
              options={[
                { label: 'Quản lý', value: 'mgmt' },
                { label: 'Vận hành', value: 'ops' },
              ]}
            />
          )}
          {/* Icon báo có bản cập nhật mới */}
          {updateAvailable && (
            <Tooltip title="Có bản cập nhật mới — bấm để tải lại trang">
              <Badge dot offset={[-2, 2]}>
                <Button
                  shape="circle"
                  icon={<SyncOutlined spin />}
                  onClick={reload}
                  style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}
                />
              </Badge>
            </Tooltip>
          )}
          {/* Chuyển theme sáng/tối — Q7: có ca trực đêm */}
          <Tooltip title={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
            <Button
              shape="circle"
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleMode}
            />
          </Tooltip>
          {/* Language switcher */}
          <Segmented
            value={lang}
            onChange={(v) => setLang(v as 'vi' | 'en')}
            options={[
              {
                value: 'vi',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                    🇻🇳 <span>VI</span>
                  </span>
                ),
              },
              {
                value: 'en',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                    🇬🇧 <span>EN</span>
                  </span>
                ),
              },
            ]}
            style={{ background: 'var(--surface-container)', fontSize: 13 }}
          />

          <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight">
            <button className="user-header-btn" style={{ cursor: 'pointer' }}>
              <div className="user-avatar">{initials}</div>
              <span>{user?.fullName}</span>
            </button>
          </Dropdown>
        </div>
      </header>

      {/* Content */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};

const MainLayout: React.FC = () => (
  <DashboardViewProvider>
    <MainLayoutInner />
  </DashboardViewProvider>
);

export default MainLayout;
