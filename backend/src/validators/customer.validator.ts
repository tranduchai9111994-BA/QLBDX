/**
 * Quy tắc kiểm tra dữ liệu khách hàng (Zod).
 * Lưu ý: việc chống TRÙNG số điện thoại / CCCD không làm ở đây mà ở customer.service.ts,
 * vì phải so sánh sau khi đã chuẩn hoá (bỏ khoảng trắng, dấu chấm) mới chính xác.
 */
import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập tên khách hàng'),
  phone: z.string().min(1, 'Vui lòng nhập số điện thoại'),
  email: z.string().email('Email không hợp lệ').optional().nullable(),
  address: z.string().optional().nullable(),
  identityCard: z.string().optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema;

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
