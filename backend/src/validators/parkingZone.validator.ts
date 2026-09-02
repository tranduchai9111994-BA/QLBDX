/**
 * Quy tắc kiểm tra dữ liệu khu vực đỗ xe (Zod).
 */
import { z } from 'zod';

export const createParkingZoneSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên khu vực'),
  description: z.string().optional().nullable(),
});

export const updateParkingZoneSchema = createParkingZoneSchema;

export type CreateParkingZoneInput = z.infer<typeof createParkingZoneSchema>;
export type UpdateParkingZoneInput = z.infer<typeof updateParkingZoneSchema>;
