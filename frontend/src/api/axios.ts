/**
 * Cấu hình chung cho mọi lời gọi API từ frontend tới backend.
 *
 * Vị trí trong luồng: đây là "cửa duy nhất" nối frontend với backend — mọi trang và hook đều gọi
 * qua đối tượng `api` này, nhờ vậy hai việc lặp đi lặp lại được xử lý một lần tại đây:
 *   1. Tự đính token đăng nhập vào mỗi request (bộ chặn chiều đi).
 *   2. Tự đăng xuất và quay về trang đăng nhập khi phiên hết hạn (bộ chặn chiều về).
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Cho phép override qua REACT_APP_API_URL để không phải sửa code khi backend đổi port/host.
// Mặc định 5001 (không dùng 5000 vì port này hay bị app khác trên máy dev chiếm).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
});

/**
 * BỘ CHẶN CHIỀU ĐI — tự động đính token vào mọi request.
 *
 * Nhờ đoạn này mà không màn hình nào phải tự nhớ gắn header Authorization. Backend sẽ đọc header
 * đó ở middlewares/auth.ts để biết ai đang gọi API.
 */
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * BỘ CHẶN CHIỀU VỀ — xử lý tập trung trường hợp phiên đăng nhập hết hạn.
 *
 * Token có hạn 24 giờ. Khi hết hạn, backend trả 401 cho MỌI API; nếu không xử lý ở đây thì từng
 * màn hình sẽ hiện lỗi rời rạc mà người dùng không hiểu vì sao. Ở đây bắt 401 một lần, xoá phiên
 * cũ và đưa về trang đăng nhập.
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const requestUrl = error.config?.url || '';
    // TRỪ chính request đăng nhập: sai mật khẩu cũng trả 401, nhưng lúc đó phải để form hiển thị
    // thông báo "sai tài khoản hoặc mật khẩu", không phải nhảy trang (đang ở trang đăng nhập rồi).
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
