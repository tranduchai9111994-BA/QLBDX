/**
 * Quy tắc kiểm tra dữ liệu tài khoản (Zod).
 * Mật khẩu chỉ bắt buộc khi TẠO tài khoản; lúc sửa thì để trống nghĩa là giữ mật khẩu cũ.
 */
import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  email: z.string().email('Email không hợp lệ').optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(['admin', 'staff']).optional().default('staff'),
  permissionGroupId: z.number().int().positive().optional().nullable(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  email: z.string().email('Email không hợp lệ').optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(['admin', 'staff']).optional().default('staff'),
  isActive: z.boolean().optional().default(true),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').optional().nullable(),
  permissionGroupId: z.number().int().positive().optional().nullable(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
