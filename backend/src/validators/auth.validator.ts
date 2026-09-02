/**
 * Quy tắc kiểm tra dữ liệu đầu vào cho nhóm API tài khoản, viết bằng thư viện Zod.
 *
 * Vị trí trong luồng: routes/auth.routes.ts gắn qua middleware `validate(schema)`, chạy TRƯỚC
 * controller — dữ liệu sai định dạng bị trả 400 ngay, không đi xuống tới service.
 */
import { z } from 'zod';

/**
 * Schema đăng nhập. Chỉ kiểm tra "đã nhập hay chưa" (min(1)), KHÔNG kiểm tra độ dài mật khẩu —
 * quy tắc độ dài chỉ áp dụng lúc ĐẶT mật khẩu (registerSchema). Nếu ràng buộc cả ở đây thì tài
 * khoản cũ lỡ đặt mật khẩu ngắn sẽ bị chặn ngay từ form và không đăng nhập được nữa.
 */
export const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập hoặc email'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

/** Schema tạo tài khoản nhân viên. Cố ý KHÔNG có trường `role` — vai trò do backend gán cứng 'staff'. */
export const registerSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  email: z.string().email('Email không hợp lệ').optional().nullable(),
  phone: z.string().optional().nullable(),
});

// z.infer suy ra kiểu TypeScript trực tiếp từ schema, nên quy tắc chỉ khai báo MỘT lần: sửa
// schema là kiểu dữ liệu tự đổi theo, không lệch giữa kiểm tra lúc chạy và kiểu lúc biên dịch.
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
