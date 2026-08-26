const pad = (n: number) => String(n).padStart(2, '0');

/** Định dạng ngày giờ chuẩn toàn hệ thống: hh:mm:ss dd/mm/yyyy — dùng khi ghép câu mô tả cảnh báo. */
export function formatDateTimeVN(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Chỉ ngày, dạng dd/mm/yyyy. */
export function formatDateVN(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
