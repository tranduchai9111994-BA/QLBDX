/**
 * Dải thông báo hiện khi mở trên màn hình hẹp.
 * Hệ thống hướng tới máy tính tại quầy trực; các bảng dữ liệu nhiều cột không hiển thị tốt trên
 * điện thoại nên báo trước cho người dùng thay vì để họ gặp giao diện vỡ.
 */
import React, { useEffect, useState } from 'react';
import { Alert } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';

const BREAKPOINT = 1024;

/**
 * T-13: app không đầu tư responsive đầy đủ (ops tool nội bộ, dùng trên desktop) — thay vì để
 * layout vỡ âm thầm dưới 1024px, báo rõ cho người dùng biết màn hình đang nhỏ hơn khuyến nghị.
 */
const DesktopOnlyBanner: React.FC = () => {
  const [tooSmall, setTooSmall] = useState(() => window.innerWidth < BREAKPOINT);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onResize = () => setTooSmall(window.innerWidth < BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!tooSmall || dismissed) return null;

  return (
    <Alert
      type="warning"
      showIcon
      icon={<DesktopOutlined />}
      banner
      closable
      onClose={() => setDismissed(true)}
      message="Ứng dụng được tối ưu cho màn hình từ 1366px trở lên — một số khu vực có thể hiển thị chưa đầy đủ trên màn hình này."
      style={{ position: 'sticky', top: 0, zIndex: 200, borderRadius: 0 }}
    />
  );
};

export default DesktopOnlyBanner;
