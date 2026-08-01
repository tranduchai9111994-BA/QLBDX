import React, { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import VehicleTypes from './pages/VehicleTypes';
import Profile from './pages/Profile';
import ActivityLogs from './pages/ActivityLogs';

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

const App: React.FC = () => {
  return (
    <ConfigProvider locale={viVN} theme={{
      token: {
        colorPrimary: '#005daa',
        colorBgBase: '#f9f9ff',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBorder: 'rgba(116, 119, 127, 0.15)',
        colorText: '#131b2c',
        colorTextSecondary: '#44474f',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        borderRadius: 8,
        fontSize: 14,
        controlHeight: 40,
        colorError: '#ba1a1a',
        colorSuccess: '#1a7a2e',
        colorWarning: '#934600',
      },
      components: {
        Card: { boxShadowTertiary: 'none' },
        Table: { borderColor: 'transparent', headerBg: '#f1f3ff' },
        Button: { primaryShadow: 'none' },
        Input: { activeBorderColor: 'transparent', hoverBorderColor: 'transparent' },
        Select: { optionSelectedBg: '#e0e8ff' },
        Modal: { contentBg: '#ffffff', headerBg: '#ffffff' },
        Menu: { darkItemBg: 'transparent', darkSubMenuItemBg: 'transparent' },
      },
    }}>
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
              <Route path="payments" element={<AdminRoute><Payments /></AdminRoute>} />
              <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
              <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
              <Route path="profile" element={<Profile />} />
              <Route path="activity-logs" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
