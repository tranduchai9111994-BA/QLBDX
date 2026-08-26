import { useEffect, useState } from 'react';

/**
 * Đồng hồ dùng chung — nguồn duy nhất cho mọi nơi cần hiển thị giờ hệ thống hiện tại
 * (A-01: trước đây có tới 3 đồng hồ độc lập không khớp nhau ở header + Dashboard).
 */
export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
