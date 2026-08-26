import React, { ReactNode } from 'react';
import { Breadcrumb, Space } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTE_META } from '../routeMeta';

interface PageHeaderProps {
  /** Ghi đè tiêu đề — mặc định lấy từ routeMeta theo path hiện tại */
  title?: string;
  /** Dòng phụ nhỏ dưới tiêu đề, VD: "Cập nhật 13:38 · Dữ liệu tháng 8/2026" */
  subtitle?: ReactNode;
  /** Nút/hành động bên phải (filter, export...) */
  actions?: ReactNode;
}

/**
 * PageHeader dùng chung — thay việc mỗi trang tự đặt <h1> rời rạc (UIUX plan T-03, B-09).
 * Breadcrumb tối giản: Trang chủ / [Nhóm] / Tiêu đề.
 */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const meta = ROUTE_META[location.pathname];
  const pageTitle = title || meta?.title || '';

  const items = [
    { title: <HomeOutlined style={{ cursor: 'pointer' }} onClick={() => navigate('/')} /> },
    ...(meta?.group ? [{ title: meta.group }] : []),
    { title: pageTitle },
  ];

  return (
    <div style={{ marginBottom: 'var(--spacing-xl)' }}>
      <Breadcrumb items={items} style={{ marginBottom: 6, fontSize: '0.8rem' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: subtitle ? 2 : 0 }}>{pageTitle}</h2>
          {subtitle && (
            <div style={{ font: 'var(--fs-caption)', color: 'var(--on-surface-variant)' }}>{subtitle}</div>
          )}
        </div>
        {actions && <Space wrap>{actions}</Space>}
      </div>
    </div>
  );
};

export default PageHeader;
