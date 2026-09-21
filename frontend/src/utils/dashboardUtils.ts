/**
 * Các hàm dùng chung cho hai màn hình Tổng quan (OpsDashboard / MgmtDashboard).
 *
 * Vì sao tách ra file riêng: cùng một con số phải hiển thị GIỐNG NHAU ở mọi chỗ. Nếu mỗi trang tự
 * viết hàm định dạng tiền / tính giờ đỗ thì rất dễ lệch nhau (chỗ ghi "25h", chỗ ghi "1 ngày 1h")
 * và người dùng sẽ tưởng hệ thống tính sai.
 */

/** Ngưỡng "đỗ lâu" thống nhất toàn hệ thống — dùng chung cho KPI, danh sách xe, và /reports/alerts (A-02). */
export const LONG_PARKING_HOURS = 24;

/**
 * Định dạng số tiền theo kiểu Việt Nam: 1500000 -> "1.500.000" (dấu chấm phân cách nghìn).
 * Dùng Intl có sẵn của trình duyệt thay vì tự viết vòng lặp chèn dấu chấm.
 */
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value);

/**
 * Số giờ đã đỗ dạng SỐ THẬP PHÂN — dùng để SO SÁNH với ngưỡng (VD: > 24 thì cảnh báo đỗ lâu).
 *
 * Cặp hàm hoursParkedRaw / hoursParked tách đôi có chủ đích:
 *   - bản này trả số     -> để máy so sánh
 *   - bản dưới trả chuỗi -> để người đọc
 * Gộp một hàm thì chỗ cần so sánh phải tách chuỗi ngược lại, rất dễ sai.
 */
export const hoursParkedRaw = (entryTime: string) => {
  const ms = Date.now() - new Date(entryTime).getTime();
  return ms / (1000 * 60 * 60);
};

/**
 * Số giờ đã đỗ dạng CHUỖI cho người đọc: "3h 25m", và quá 24 giờ thì đổi sang "2 ngày 5h"
 * (vì "53h" thì người xem phải tự nhẩm chia 24).
 *
 * Lưu ý: hàm này chỉ để HIỂN THỊ, không phải để tính tiền. Tiền do backend tính
 * (backend/src/utils/feeCalculator.ts) — nếu tính ở đây thì sửa giờ trên máy khách là đổi được
 * số tiền phải trả.
 */
export const hoursParked = (entryTime: string) => {
  const ms = Date.now() - new Date(entryTime).getTime();
  // Math.max(0, ...) chặn số âm: nếu giờ trên máy khách bị lùi lại so với giờ server thì
  // entryTime sẽ "ở tương lai" và hiệu số ra số âm -> hiện "-2h" rất vô nghĩa.
  const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} ngày ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
};
