/** Ngưỡng "đỗ lâu" thống nhất toàn hệ thống — dùng chung cho KPI, danh sách xe, và /reports/alerts (A-02). */
export const LONG_PARKING_HOURS = 24;

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value);

export const hoursParkedRaw = (entryTime: string) => {
  const ms = Date.now() - new Date(entryTime).getTime();
  return ms / (1000 * 60 * 60);
};

export const hoursParked = (entryTime: string) => {
  const ms = Date.now() - new Date(entryTime).getTime();
  const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} ngày ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
};
