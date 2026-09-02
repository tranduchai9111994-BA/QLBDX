/**
 * Quản lý trạng thái ĐĂNG NHẬP dùng chung cho toàn ứng dụng (React Context).
 *
 * Vì sao dùng Context: thông tin người đăng nhập cần cho rất nhiều nơi (thanh tiêu đề, kiểm tra
 * quyền hiển thị nút, chặn route). Nếu truyền qua props thì phải chuyền tay qua nhiều tầng
 * component. Context cho phép component ở bất kỳ đâu gọi `useAuth()` để lấy trực tiếp.
 *
 * Vị trí trong luồng:
 *   Login.tsx gọi login() -> POST /api/auth/login -> lưu token vào localStorage
 *     -> gọi tiếp GET /api/auth/me để lấy thông tin + ma trận quyền
 *     -> lưu vào state -> PermissionGate và MainLayout dùng để ẩn/hiện chức năng
 *
 * Lưu ý: dữ liệu quyền ở đây chỉ để ẨN/HIỆN giao diện cho gọn. Việc CHẶN thật nằm ở backend
 * (middlewares/requirePermission.ts) — ẩn nút không phải là bảo mật.
 */
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../api/axios';
import { User, LoginCredentials, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider bọc quanh toàn bộ ứng dụng (xem App.tsx), cung cấp thông tin đăng nhập cho mọi trang.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Khởi tạo state từ localStorage ngay lập tức để tải lại trang không bị "nháy" về màn đăng nhập
  // trong lúc chờ gọi /auth/me. Đây là dữ liệu tạm cho giao diện; nguồn đáng tin vẫn là backend.
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Mỗi lần mở lại ứng dụng: nếu còn token thì hỏi lại backend xem token còn hiệu lực không và
  // lấy thông tin/quyền mới nhất. Không tin dữ liệu trong localStorage, vì quyền có thể đã bị
  // admin thay đổi hoặc tài khoản đã bị khoá kể từ lần đăng nhập trước.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get<User>('/auth/me')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        // Token hỏng hoặc hết hạn -> dọn sạch phiên cũ để người dùng đăng nhập lại.
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    // /auth/login chỉ trả thông tin cơ bản — permissions (nhóm quyền) nằm ở /auth/me. Gọi tiếp
    // ngay ở đây để user.permissions có sẵn ngay sau khi đăng nhập, không phải chờ reload trang
    // mới trúng lại effect load-on-mount bên trên.
    const profileRes = await api.get<User>('/auth/me');
    localStorage.setItem('user', JSON.stringify(profileRes.data));
    setUser(profileRes.data);
    return res.data;
  };

  const logout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook để mọi component lấy thông tin đăng nhập: `const { user, logout } = useAuth()`.
 *
 * Ném lỗi rõ ràng nếu bị gọi bên ngoài AuthProvider — giúp phát hiện ngay lúc phát triển, thay
 * vì nhận về `null` rồi lỗi khó hiểu ở chỗ khác.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
