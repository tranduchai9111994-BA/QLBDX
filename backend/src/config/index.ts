/**
 * Cấu hình chạy của backend, đọc từ biến môi trường (file backend/.env).
 *
 * Gom về một chỗ để không rải `process.env` khắp code — muốn biết hệ thống cần khai báo
 * những gì thì chỉ cần đọc file này.
 */
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  /** Cổng backend lắng nghe. Frontend gọi tới đây qua REACT_APP_API_URL (mặc định :5001). */
  port: parseInt(process.env.PORT || '5001', 10),
  /**
   * Khoá ký JWT. Có giá trị dự phòng để `npm run dev` chạy được ngay khi chưa tạo .env,
   * nhưng khi triển khai thật BẮT BUỘC đặt JWT_SECRET riêng — nếu không ai cũng tự ký được
   * token hợp lệ và vượt qua middleware `auth`.
   */
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-me',
  /** Thời hạn token. Hết hạn thì `jwt.verify` ném lỗi -> middleware `auth` trả 401. */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
};
