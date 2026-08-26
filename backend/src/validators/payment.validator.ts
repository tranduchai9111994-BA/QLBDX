import { z } from 'zod';

export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive('Số tiền phải lớn hơn 0'),
  paymentMethod: z.enum(['cash', 'card', 'transfer'], { errorMap: () => ({ message: 'Phương thức thanh toán không hợp lệ' }) }),
  notes: z.string().max(500, 'Ghi chú tối đa 500 ký tự').optional().nullable(),
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
