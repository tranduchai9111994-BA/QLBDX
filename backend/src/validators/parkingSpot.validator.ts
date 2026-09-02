/**
 * Quy tắc kiểm tra dữ liệu chỗ đỗ (Zod).
 */
import { z } from 'zod';

export const createParkingSpotSchema = z.object({
  zoneId: z.number().int().positive('ZoneId không hợp lệ'),
  spotNumber: z.string().min(1, 'Vui lòng nhập số chỗ'),
  spotType: z.enum(['standard', 'vip', 'disabled']).optional().default('standard'),
});

export const updateParkingSpotSchema = z.object({
  spotType: z.enum(['standard', 'vip', 'disabled']).optional().default('standard'),
  status: z.enum(['available', 'occupied', 'reserved', 'maintenance']).optional().default('available'),
});

export type CreateParkingSpotInput = z.infer<typeof createParkingSpotSchema>;
export type UpdateParkingSpotInput = z.infer<typeof updateParkingSpotSchema>;
