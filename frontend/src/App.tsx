import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import enUS from 'antd/locale/en_US';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useAntdTheme } from './theme/useAntdTheme';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ParkingEntry from './pages/ParkingEntry';
import ParkingExit from './pages/ParkingExit';
import ParkingHistory from './pages/ParkingHistory';
import Customers from './pages/Customers';
import Vehicles from './pages/Vehicles';
import ParkingSpots from './pages/ParkingSpots';
import Packages from './pages/Packages';
import CustomerPackages from './pages/CustomerPackages';
import Payments from './pages/Payments';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics';
import VehicleTypes from './pages/VehicleTypes';
import Profile from './pages/Profile';
import ActivityLogs from './pages/ActivityLogs';
import Alerts from './pages/Alerts';

interface PrivateRouteProps {
  children: ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
};

interface PermissionRouteProps {
  children: ReactNode;
  screenKey: string;
}

/** Thay AdminRoute cho các màn nằm trong ma trận phân quyền (Thanh toán/Cảnh báo/Báo cáo) — admin
 * luôn vào được, staff vào được nếu nhóm quyền của họ có dòng cấu hình cho đúng screenKey này
 * (admin phải chủ động tick ít nhất 1 quyền Thêm/Sửa/Xóa ở trang Nhóm quyền thì mới có dòng đó). */
const PermissionRoute: React.FC<PermissionRouteProps> = ({ children, screenKey }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <>{children}</>;
  const hasAccess = (user.permissions || []).some((p) => p.screenKey === screenKey);
  if (!hasAccess) return <Navigate to="/" />;
  return <>{children}</>;
};

const AppInner: React.FC = () => {
  const { lang } = useLanguage();
  const { mode } = useTheme();
  const antdTheme = useAntdTheme(mode);
  return (
    <ConfigProvider locale={lang === 'en' ? enUS : viVN} theme={antdTheme}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="parking/entry" element={<ParkingEntry />} />
              <Route path="parking/exit" element={<ParkingExit />} />
              <Route path="parking/history" element={<ParkingHistory />} />
              <Route path="customers" element={<Customers />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="vehicle-types" element={<VehicleTypes />} />
              <Route path="parking-spots" element={<ParkingSpots />} />
              <Route path="packages" element={<Packages />} />
              <Route path="customer-packages" element={<CustomerPackages />} />
              <Route path="payments" element={<PermissionRoute screenKey="payments"><Payments /></PermissionRoute>} />
              <Route path="alerts" element={<PermissionRoute screenKey="alerts"><Alerts /></PermissionRoute>} />
              <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
              <Route path="reports" element={<PermissionRoute screenKey="reports"><Reports /></PermissionRoute>} />
              <Route path="analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
              <Route path="profile" element={<Profile />} />
              <Route path="activity-logs" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
