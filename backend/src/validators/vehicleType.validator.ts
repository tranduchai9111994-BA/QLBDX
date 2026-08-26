import { z } from 'zod';

export const createVehicleTypeSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên loại xe'),
  description: z.string().optional().nullable(),
  // z.coerce: Prisma Decimal serialize qua JSON thành string (VD: "5000"), form frontend
  // có thể gửi lại nguyên giá trị đó nếu người dùng không gõ lại field -> coerce cho chắc.
  hourlyRate: z.coerce.number().positive('Giá theo giờ phải lớn hơn 0'),
  dailyRate: z.coerce.number().positive('Giá theo ngày phải lớn hơn 0'),
  monthlyRate: z.coerce.number().positive('Giá theo tháng phải lớn hơn 0'),
});

export const updateVehicleTypeSchema = createVehicleTypeSchema;

export const scheduleRateChangeSchema = z.object({
  hourlyRate: z.coerce.number().positive('Giá theo giờ phải lớn hơn 0'),
  dailyRate: z.coerce.number().positive('Giá theo ngày phải lớn hơn 0'),
  monthlyRate: z.coerce.number().positive('Giá theo tháng phải lớn hơn 0'),
  effectiveFrom: z.string().min(1, 'Vui lòng chọn ngày hiệu lực'),
});

export type CreateVehicleTypeInput = z.infer<typeof createVehicleTypeSchema>;
export type UpdateVehicleTypeInput = z.infer<typeof updateVehicleTypeSchema>;
export type ScheduleRateChangeInput = z.infer<typeof scheduleRateChangeSchema>;
