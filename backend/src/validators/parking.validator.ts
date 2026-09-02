/**
 * Quy tắc kiểm tra dữ liệu đầu vào cho nhóm API vận hành bãi xe (Zod).
 * Gắn vào route qua middleware `validate(...)`, chạy trước controller.
 */
import { z } from 'zod';

/**
 * Định dạng biển số hợp lệ, kiểm tra SAU khi đã bỏ dấu gạch/khoảng trắng và chuyển hoa.
 * Hai dạng được chấp nhận:
 *   - Biển dân sự: 2 chữ số tỉnh + 1-2 chữ cái seri + 4-6 chữ số   (29A87642, 51H423456)
 *   - Biển 2 chữ cái đầu: 2 chữ cái + 3-5 chữ số                    (LD12345)
 * Chặn ngay từ đây để dữ liệu rác không lọt vào bảng ParkingRecords, vì biển số là khoá để
 * đối chiếu lúc xe ra.
 */
const licensePlateRegex = /^(\d{2}[A-Z]{1,2}\d{4,6}|[A-Z]{2}\d{3,5})$/;

/** Dữ liệu form Xe vào. */
export const parkingEntrySchema = z.object({
  licensePlate: z.string().min(1, 'Vui lòng nhập biển số xe').regex(licensePlateRegex, 'Biển số không đúng định dạng (VD: 29A87642)'),
  vehicleTypeId: z.number().int().positive('Vui lòng chọn loại xe'),
  parkingSpotId: z.number().int().positive('Vui lòng chọn chỗ đỗ'),
  notes: z.string().optional().nullable(),
});

/** Dữ liệu form Xe ra thông thường. `default('cash')` để client không gửi thì mặc định tiền mặt. */
export const parkingExitSchema = z.object({
  parkingRecordId: z.number().int().positive('Vui lòng chọn bản ghi đỗ xe'),
  paymentMethod: z.enum(['cash', 'card', 'transfer']).optional().default('cash'),
});

/**
 * Dữ liệu form Xe ra ngoại lệ. Chặt hơn luồng thường ở hai điểm:
 *   - `exceptionReason` phải nằm trong danh sách cố định, không cho gõ tự do.
 *   - `exceptionNote` bắt buộc tối thiểu 5 ký tự — bắt nhân viên giải trình, để sau này đối soát
 *     còn biết vì sao lượt đó được miễn phí hoặc giảm tiền.
 */
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
