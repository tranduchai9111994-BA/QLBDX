/**
 * Component gốc của ứng dụng — khai báo BẢN ĐỒ ĐƯỜNG DẪN và bọc các provider dùng chung.
 *
 * Đây là chỗ nên mở đầu tiên khi muốn biết "màn hình này ứng với file nào": mỗi thẻ <Route>
 * nối một đường dẫn trên trình duyệt với một component trong thư mục pages/.
 *
 * Ba mức bảo vệ route, từ nhẹ tới chặt:
 *   PrivateRoute     — chỉ cần đã đăng nhập.
 *   PermissionRoute  — phải có quyền trên màn hình đó theo nhóm quyền.
 *   AdminRoute       — chỉ admin.
 */
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

/**
 * Chặn route theo ĐĂNG NHẬP: chưa đăng nhập thì đẩy về /login.
 *
 * `if (loading) return null` rất quan trọng: lúc mới mở ứng dụng, AuthContext còn đang gọi
 * /auth/me để xác thực token. Nếu không chờ, `user` tạm thời là null và người dùng đang đăng
 * nhập hợp lệ vẫn bị đá ra màn hình đăng nhập.
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

interface AdminRouteProps {
  children: ReactNode;
}

/** Chặn route theo VAI TRÒ: chỉ admin vào được (Người dùng, Phân tích, Nhật ký hoạt động). */
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

/**
 * Chặn route theo NHÓM QUYỀN — dùng cho các màn hình nằm trong ma trận phân quyền
 * (Thanh toán / Cảnh báo / Báo cáo).
 *
 * Admin luôn vào được. Nhân viên vào được nếu nhóm quyền của họ có dòng cấu hình cho đúng
 * `screenKey` này — admin phải tick ít nhất một quyền Thêm/Sửa/Xoá ở trang Nhóm quyền thì dòng
 * đó mới tồn tại.
 *
 * Lưu ý: đây chỉ là lớp chặn ĐIỀU HƯỚNG cho trải nghiệm người dùng. Lớp chặn thật nằm ở backend
 * (middlewares/requirePermission.ts) — gõ thẳng URL hay gọi API trực tiếp vẫn bị backend từ chối.
 */
const PermissionRoute: React.FC<PermissionRouteProps> = ({ children, screenKey }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <>{children}</>;
  const hasAccess = (user.permissions || []).some((p) => p.screenKey === screenKey);
  if (!hasAccess) return <Navigate to="/" />;
  return <>{children}</>;
};

/**
 * Phần thân ứng dụng: khai báo toàn bộ bản đồ đường dẫn (routing).
 *
 * Tách riêng khỏi `App` bên dưới vì component này cần đọc ngôn ngữ và giao diện sáng/tối bằng
 * hook — mà hook chỉ dùng được BÊN TRONG provider tương ứng.
 */
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
            {/* Mọi trang bên trong đều nằm trong MainLayout (menu trái + thanh tiêu đề) và đều
                phải đăng nhập. Route con nào cần quyền cao hơn thì bọc thêm AdminRoute hoặc
                PermissionRoute như bên dưới. */}
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

/**
 * Thứ tự lồng các provider có ý nghĩa: provider ngoài cung cấp dữ liệu cho provider trong.
 *   ThemeProvider (sáng/tối) -> LanguageProvider (Việt/Anh) -> AppInner -> AuthProvider (đăng nhập)
 */
const App: React.FC = () => (
  <ThemeProvider>
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  </ThemeProvider>
);

export default App;
