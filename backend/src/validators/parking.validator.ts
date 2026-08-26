import { z } from 'zod';

const licensePlateRegex = /^\d{2}[A-Z]\d{4,5}$/;

export const parkingEntrySchema = z.object({
  licensePlate: z.string().min(1, 'Vui lòng nhập biển số xe').regex(licensePlateRegex, 'Biển số không đúng định dạng (VD: 29A87642)'),
  vehicleTypeId: z.number().int().positive('Vui lòng chọn loại xe'),
  parkingSpotId: z.number().int().positive('Vui lòng chọn chỗ đỗ'),
  notes: z.string().optional().nullable(),
});

export const parkingExitSchema = z.object({
  parkingRecordId: z.number().int().positive('Vui lòng chọn bản ghi đỗ xe'),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional().default('cash'),
});

export const parkingExitExceptionSchema = z.object({
  parkingRecordId: z.number().int().positive('Vui lòng chọn bản ghi đỗ xe'),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional().default('cash'),
  exceptionReason: z.enum([
    'lost_ticket',
    'damaged_ticket',
    'force_release',
    'fee_waiver',
    'other',
  ], { required_error: 'Vui lòng chọn lý do ngoại lệ' }),
  exceptionNote: z.string().trim().min(5, 'Vui lòng ghi chú lý do ngoại lệ (tối thiểu 5 ký tự)'),
  waiveFee: z.boolean().optional().default(false),
  overrideFee: z.number().min(0, 'Phí ghi đè không hợp lệ').optional().nullable(),
});

export type ParkingEntryInput = z.infer<typeof parkingEntrySchema>;
export type ParkingExitInput = z.infer<typeof parkingExitSchema>;
export type ParkingExitExceptionInput = z.infer<typeof parkingExitExceptionSchema>;
