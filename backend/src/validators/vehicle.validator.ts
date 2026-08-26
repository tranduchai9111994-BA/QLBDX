import { z } from 'zod';

// Biển số ô tô/xe máy chuẩn (29A12345, 59FA2345, 59N156789...) hoặc mã nội bộ 2 chữ cái cho xe không có biển
// (VD: XD001 cho xe đạp) — client chuẩn hoá bỏ dấu -/./khoảng trắng trước khi validate.
const licensePlateRegex = /^(\d{2}[A-Z]{1,2}\d{4,6}|[A-Z]{2}\d{3,5})$/;

export const createVehicleSchema = z.object({
  customerId: z.number().int().positive('CustomerId không hợp lệ'),
  vehicleTypeId: z.number().int().positive('VehicleTypeId không hợp lệ'),
  licensePlate: z.string().min(1, 'Vui lòng nhập biển số xe').regex(licensePlateRegex, 'Biển số không đúng định dạng (VD: 29A87642)'),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema;

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
