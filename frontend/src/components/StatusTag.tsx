import React from 'react';
import { Tag } from 'antd';

interface StatusConfig {
  label: string;
  color: string;
}

/** Các bộ trạng thái dùng chung — thêm domain mới khi cần thay vì viết Tag color=... rời rạc từng trang. */
const PRESETS = {
  toggle: {
    active: { label: 'Đang áp dụng', color: 'success' },
    inactive: { label: 'Ngừng áp dụng', color: 'default' },
  },
  user: {
    active: { label: 'Hoạt động', color: 'success' },
    inactive: { label: 'Ngừng hoạt động', color: 'default' },
  },
  customerPackage: {
    active: { label: 'Hoạt động', color: 'success' },
    pending: { label: 'Chưa hiệu lực', color: 'gold' },
    expired: { label: 'Hết hạn', color: 'default' },
    cancelled: { label: 'Đã hủy', color: 'error' },
  },
  parkingRecord: {
    parked: { label: 'Đang đỗ', color: 'processing' },
    completed: { label: 'Đã ra', color: 'success' },
  },
  payment: {
    completed: { label: 'Thành công', color: 'success' },
    pending: { label: 'Chờ xử lý', color: 'gold' },
    failed: { label: 'Thất bại', color: 'error' },
  },
  vehicleParking: {
    parked: { label: 'Đang trong bãi', color: 'red' },
    outside: { label: 'Đang ở ngoài', color: 'green' },
  },
} satisfies Record<string, Record<string, StatusConfig>>;

export type StatusDomain = keyof typeof PRESETS;

interface StatusTagProps {
  domain: StatusDomain;
  /** Chuỗi trạng thái (VD: 'active') hoặc boolean cho domain dạng bật/tắt (true → 'active', false → 'inactive') */
  value: string | boolean;
  extra?: React.ReactNode;
  /** Ghi đè label mặc định (VD: dịch theo i18n của trang) — vẫn giữ màu theo domain/value */
  label?: string;
}

const StatusTag: React.FC<StatusTagProps> = ({ domain, value, extra, label }) => {
  const key = typeof value === 'boolean' ? (value ? 'active' : 'inactive') : value;
  const presets = PRESETS[domain] as Record<string, StatusConfig>;
  const cfg = presets[key] ?? { label: String(value), color: 'default' };
  return (
    <Tag color={cfg.color}>
      {label ?? cfg.label}
      {extra}
    </Tag>
  );
};

export default StatusTag;
