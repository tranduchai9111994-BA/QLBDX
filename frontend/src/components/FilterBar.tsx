import React, { ReactNode } from 'react';
import { Card, Space, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
}

/** Thanh bộ lọc dùng chung — Card + Space wrap + nút xóa lọc, thay cho layout lặp lại ở đầu mỗi trang danh sách. */
const FilterBar: React.FC<FilterBarProps> = ({ children, onReset, resetLabel = 'Xóa bộ lọc' }) => (
  <Card style={{ marginBottom: 16 }}>
    <Space wrap>
      {children}
      {onReset && <Button icon={<ReloadOutlined />} onClick={onReset}>{resetLabel}</Button>}
    </Space>
  </Card>
);

export default FilterBar;
