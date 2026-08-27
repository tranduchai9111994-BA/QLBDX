import { z } from 'zod';

const validWindowRefine = (data: { validFrom?: string | null; validTo?: string | null }, ctx: z.RefinementCtx) => {
  if (data.validFrom && data.validTo && new Date(data.validTo) < new Date(data.validFrom)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Đến ngày phải sau hoặc bằng Từ ngày', path: ['validTo'] });
  }
};

export const createPackageSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên gói'),
  vehicleTypeId: z.number().int().positive('VehicleTypeId không hợp lệ'),
  durationDays: z.number().int().positive('Số ngày phải lớn hơn 0'),
  // z.coerce: Prisma Decimal serialize qua JSON thành string (VD: "200000"), form frontend
  // có thể gửi lại nguyên giá trị đó nếu người dùng không gõ lại field -> coerce cho chắc.
  price: z.coerce.number().positive('Giá phải lớn hơn 0'),
  description: z.string().optional().nullable(),
  // Khoảng thời gian được đăng ký — bỏ trống = bán quanh năm, không giới hạn.
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
}).superRefine(validWindowRefine);

export const updatePackageSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên gói'),
  vehicleTypeId: z.number().int().positive('VehicleTypeId không hợp lệ'),
  durationDays: z.number().int().positive('Số ngày phải lớn hơn 0'),
  // z.coerce: Prisma Decimal serialize qua JSON thành string (VD: "200000"), form frontend
  // có thể gửi lại nguyên giá trị đó nếu người dùng không gõ lại field -> coerce cho chắc.
  price: z.coerce.number().positive('Giá phải lớn hơn 0'),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
}).superRefine(validWindowRefine);

export const schedulePriceChangeSchema = z.object({
  // z.coerce: Prisma Decimal serialize qua JSON thành string (VD: "200000"), form frontend
  // có thể gửi lại nguyên giá trị đó nếu người dùng không gõ lại field -> coerce cho chắc.
  price: z.coerce.number().positive('Giá phải lớn hơn 0'),
  effectiveFrom: z.string().min(1, 'Vui lòng chọn ngày hiệu lực'),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type SchedulePriceChangeInput = z.infer<typeof schedulePriceChangeSchema>;
