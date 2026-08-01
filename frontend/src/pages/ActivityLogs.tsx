import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, DatePicker, Select, Input, Tag, Tooltip, Button, Row, Col, Statistic,
} from 'antd';
import {
  LoginOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined,
  WarningOutlined, FileSearchOutlined, SearchOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { ActivityLog, ActivityLogPage } from '../types';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ACTION_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  LOGIN:        { color: 'success',   label: 'Đăng nhập',          icon: <LoginOutlined /> },
  LOGIN_FAILED: { color: 'error',     label: 'ĐN thất bại',        icon: <WarningOutlined /> },
  CREATE:       { color: 'processing',label: 'Tạo mới',            icon: <PlusCircleOutlined /> },
  UPDATE:       { color: 'warning',   label: 'Cập nhật',           icon: <EditOutlined /> },
  DELETE:       { color: 'error',     label: 'Xóa',                icon: <DeleteOutlined /> },
};

const ENTITY_LABELS: Record<string, string> = {
  Users:            'Người dùng',
  Customers:        'Khách hàng',
  Vehicles:         'Phương tiện',
  VehicleTypes:     'Loại xe',
  ParkingZones:     'Khu bãi',
  ParkingSpots:     'Vị trí đỗ',
  ParkingPackages:  'Gói dịch vụ',
  CustomerPackages: 'Đăng ký gói',
  ParkingRecords:   'Ra vào xe',
};

const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE'];
const ENTITIES = Object.keys(ENTITY_LABELS);

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  action: string | undefined;
  entity: string | undefined;
  username: string;
}

const ActivityLogs: React.FC = () => {
  const [data, setData] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    action: undefined,
    entity: undefined,
    username: '',
  });
  const [searchInput, setSearchInput] = useState('');

  const fetchLogs = useCallback(async (currentPage: number, f: Filters) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: pageSize,
      };
      if (f.action) params.action = f.action;
      if (f.entity) params.entity = f.entity;
      if (f.username) params.username = f.username;
      if (f.dateRange) {
        params.from = f.dateRange[0].startOf('day').toISOString();
        params.to = f.dateRange[1].endOf('day').toISOString();
      }
      const res = await api.get<ActivityLogPage>('/activity-logs', { params });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchLogs(page, filters);
  }, [page, filters, fetchLogs]);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setPage(1);
    setFilters(f => ({
      ...f,
      dateRange: dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null,
    }));
  };

  const handleActionChange = (value: string | undefined) => {
    setPage(1);
    setFilters(f => ({ ...f, action: value }));
  };

  const handleEntityChange = (value: string | undefined) => {
    setPage(1);
    setFilters(f => ({ ...f, entity: value }));
  };

  const handleSearch = () => {
    setPage(1);
    setFilters(f => ({ ...f, username: searchInput.trim() }));
  };

  const handleReset = () => {
    setSearchInput('');
    setPage(1);
    setFilters({ dateRange: null, action: undefined, entity: undefined, username: '' });
  };

  // counts for summary cards
  const statusSuccess = data.filter(d => d.statusCode !== null && d.statusCode !== undefined && d.statusCode >= 200 && d.statusCode < 300).length;
  const statusFailed  = data.filter(d => d.statusCode !== null && d.statusCode !== undefined && d.statusCode >= 400).length;
  const statusOther   = data.filter(d => !d.statusCode).length;

  const columns: ColumnsType<ActivityLog> = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}>
          {dayjs(v).format('DD/MM/YYYY HH:mm:ss')}
        </span>
      ),
    },
    {
      title: 'Người dùng',
      key: 'user',
      width: 170,
      render: (_: unknown, record: ActivityLog) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{record.username}</div>
          {record.user?.fullName && (
            <div style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)' }}>
              {record.user.fullName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Hành động',
      dataIndex: 'action',
      key: 'action',
      width: 130,
      render: (action: string) => {
        const cfg = ACTION_CONFIG[action];
        if (!cfg) return <Tag>{action}</Tag>;
        return (
          <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 600 }}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 160,
      render: (_: unknown, record: ActivityLog) => {
        if (!record.entity) return <span style={{ color: 'var(--outline)' }}>—</span>;
        const label = ENTITY_LABELS[record.entity] ?? record.entity;
        return (
          <span>
            <Tag style={{ marginRight: 4 }}>{label}</Tag>
            {record.entityId && (
              <span style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)' }}>
                #{record.entityId}
              </span>
            )}
          </span>
        );
      },
    },
    {
      title: 'Chi tiết',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ fontSize: '0.82rem', color: 'var(--on-surface-variant)' }}>
              <FileSearchOutlined style={{ marginRight: 4 }} />{v}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--outline)' }}>—</span>
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 100,
      render: (v: string | null) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--on-surface-variant)' }}>
          {v ?? '—'}
        </span>
      ),
    },
    {
      title: 'HTTP',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 100,
      align: 'center',
      render: (code: number | null) => {
        if (!code) return <span style={{ color: 'var(--outline)' }}>—</span>;
        const color = code < 300 ? 'success' : code < 400 ? 'warning' : 'error';
        return <Tag color={color}>{code}</Tag>;
      },
    },
  ];

  return (
    <div>
      <h2 className="page-title">Nhật ký hoạt động</h2>

      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: 'var(--success-container)', border: 'none' }}>
            <Statistic
              title={
                <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.78rem' }}>
                  HTTP 2xx — THÀNH CÔNG
                </span>
              }
              value={statusSuccess}
              suffix={
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--success)' }}>
                  &nbsp;yêu cầu
                </span>
              }
              valueStyle={{ color: 'var(--success)', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: 'var(--error-container)', border: 'none' }}>
            <Statistic
              title={
                <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.78rem' }}>
                  HTTP 4xx/5xx — THẤT BẠI
                </span>
              }
              value={statusFailed}
              suffix={
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--error)' }}>
                  &nbsp;yêu cầu
                </span>
              }
              valueStyle={{ color: 'var(--error)', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: 'var(--surface-container)', border: 'none' }}>
            <Statistic
              title={
                <span style={{ color: 'var(--on-surface-variant)', fontWeight: 600, fontSize: '0.78rem' }}>
                  KHÔNG CÓ STATUS CODE
                </span>
              }
              value={statusOther}
              suffix={
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--on-surface-variant)' }}>
                  &nbsp;yêu cầu
                </span>
              }
              valueStyle={{ color: 'var(--on-surface-variant)', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={7}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={filters.dateRange}
              onChange={handleDateChange}
              placeholder={['Từ ngày', 'Đến ngày']}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Hành động"
              allowClear
              value={filters.action}
              onChange={handleActionChange}
            >
              {ACTIONS.map(a => (
                <Option key={a} value={a}>
                  {ACTION_CONFIG[a]?.label ?? a}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Đối tượng"
              allowClear
              value={filters.entity}
              onChange={handleEntityChange}
            >
              {ENTITIES.map(e => (
                <Option key={e} value={e}>{ENTITY_LABELS[e]}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={16} sm={8} md={5}>
            <Input
              placeholder="Tên đăng nhập..."
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={8} sm={4} md={4} style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              Tìm
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset} />
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card size="small">
        <Table<ActivityLog>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `Tổng ${t} bản ghi`,
            onChange: (p) => setPage(p),
          }}
          rowClassName={(record) =>
            record.action === 'LOGIN_FAILED' ? 'ant-table-row-danger' : ''
          }
        />
      </Card>

      <style>{`
        .ant-table-row-danger td {
          background: #fff5f5 !important;
        }
      `}</style>
    </div>
  );
};

export default ActivityLogs;
