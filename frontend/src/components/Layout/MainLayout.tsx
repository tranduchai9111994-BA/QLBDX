import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Dropdown, MenuProps, Segmented } from 'antd';
import {
  DashboardOutlined, CarOutlined, LoginOutlined, LogoutOutlined,
  UserOutlined, TeamOutlined, EnvironmentOutlined, GiftOutlined,
  DollarOutlined, BarChartOutlined, SettingOutlined, HistoryOutlined,
  AppstoreOutlined, AuditOutlined, AlertOutlined, FundOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { loadStaffPerms, getStaffVisibleKeys } from '../../utils/permConfig';

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  // Staff perm config
  const [staffVisible, setStaffVisible] = useState<Set<string>>(() =>
    getStaffVisibleKeys(loadStaffPerms())
  );
  useEffect(() => {
    const onStorage = () => setStaffVisible(getStaffVisibleKeys(loadStaffPerms()));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const canSee = (key: string) => isAdmin || staffVisible.has(key);

  const menuItems: MenuProps['items'] = [
    canSee('dashboard') ? { key: '/', icon: <DashboardOutlined />, label: t('menuDashboard') } : null,
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
    canSee('parking-spots')     ? { key: '/parking-spots',      icon: <EnvironmentOutlined />, label: t('menuParkingSpots') }      : null,
    canSee('customers')         ? { key: '/customers',           icon: <TeamOutlined />,        label: t('menuCustomers') }         : null,
    canSee('vehicles')          ? { key: '/vehicles',            icon: <CarOutlined />,         label: t('menuVehicles') }          : null,
    canSee('vehicle-types')     ? { key: '/vehicle-types',       icon: <AppstoreOutlined />,    label: t('menuVehicleTypes') }      : null,
    (canSee('packages') || canSee('customer-packages'))
      ? {
          key: 'packages',
          icon: <GiftOutlined />,
          label: t('menuPackages'),
          children: [
            canSee('packages')          ? { key: '/packages',          label: t('menuPackageList') }        : null,
            canSee('customer-packages') ? { key: '/customer-packages', label: t('menuCustomerPackages') }   : null,
          ].filter(Boolean) as MenuProps['items'],
        }
      : null,
    canSee('payments') ? { key: '/payments',      icon: <DollarOutlined />,   label: t('menuPayments') }      : null,
    canSee('alerts')   ? { key: '/alerts',         icon: <AlertOutlined />,    label: t('menuAlerts') }        : null,
    canSee('reports')  ? { key: '/reports',        icon: <BarChartOutlined />, label: t('menuReports') }       : null,
    isAdmin ? { key: '/analytics', icon: <FundOutlined />, label: t('menuAnalytics') } : null,
    isAdmin ? { key: '/users',         icon: <SettingOutlined />, label: t('menuUsers') }         : null,
    isAdmin ? { key: '/activity-logs', icon: <AuditOutlined />,   label: t('menuActivityLogs') }  : null,
  ].filter(Boolean) as MenuProps['items'];

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

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const initials = user?.fullName
    ? user.fullName.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()
    : 'U';

  const dateLocale = lang === 'en' ? 'en-US' : 'vi-VN';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">P</div>
          <span className="logo-text">{t('appShort')}</span>
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
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--on-surface)' }}>
            {t('appName')}
          </span>
          <span style={{ color: 'var(--on-surface-variant)', fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
            {currentTime.toLocaleDateString(dateLocale, { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            {' — '}
            {currentTime.toLocaleTimeString(dateLocale)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

export default MainLayout;
