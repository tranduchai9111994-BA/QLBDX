/**
 * Hàm định dạng ngày giờ theo chuẩn Việt Nam (dd/MM/yyyy), dùng chung cho mọi màn hình.
 */
import dayjs, { Dayjs } from 'dayjs';

type DateInput = string | number | Date | Dayjs | null | undefined;

/** Định dạng ngày giờ chuẩn toàn hệ thống: hh:mm:ss dd/mm/yyyy (giờ trước, ngày sau). */
export function formatDateTime(value: DateInput): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('HH:mm:ss DD/MM/YYYY') : '-';
}

/** Chỉ ngày, dùng cho các trường hợp không cần giờ (VD: ngày bắt đầu/kết thúc gói). */
export function formatDate(value: DateInput): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD/MM/YYYY') : '-';
}
