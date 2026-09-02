/**
 * Màn hình CẢNH BÁO HỆ THỐNG — gồm ba tab:
 *   1. Danh sách cảnh báo   : kết quả quét từ /api/reports/alerts (report.service.ts -> getAlerts).
 *   2. Cấu hình mức độ      : đặt ngưỡng cho từng loại cảnh báo (AlertSettingsPanel).
 *   3. Cấu hình nâng cao    : quản trị bộ luật của hệ chuyên gia (ExpertRulesPanel).
 *
 * Điểm đáng nói khi trình bày: toàn bộ ngưỡng cảnh báo là DỮ LIỆU cấu hình được, không phải câu
 * lệnh if/else viết cứng trong mã nguồn.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Select, InputNumber, Row, Col, Statistic, Space, message, Dropdown, Segmented, DatePicker, Tooltip, Tabs } from 'antd';
import {
  AlertOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FireOutlined,
  ReloadOutlined, DownloadOutlined, FileExcelOutlined, FileTextOutlined,
  CalendarOutlined, BulbOutlined, SettingOutlined, UnorderedListOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import AlertSettingsPanel from '../components/AlertSettingsPanel';
import ExpertRulesPanel from '../components/ExpertRulesPanel';
import { formatDateTime } from '../utils/dateFormat';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AlertItem } from '../types';
import { exportAlertsExcel, exportAlertsCsv } from '../utils/reportExport';
import { useLanguage } from '../context/LanguageContext';
import { defaultPagination } from '../utils/tablePagination';

type PeriodKey = 'all' | 'today' | '7days' | '30days' | 'thisMonth' | 'custom';

const { RangePicker } = DatePicker;

const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [longParkingHours, setLongParkingHours] = useState(24);
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get<AlertItem[]>('/reports/alerts', {
        params: { longParkingHours },
      });
      setAlerts(res.data);
    } catch {
      message.error('Không tải được danh sách cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [longParkingHours]);

  const getPeriodRange = (): [Date, Date] | null => {
    const now = new Date();
    if (periodFilter === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return [start, now];
    }
    if (periodFilter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return [start, now];
    }
    if (periodFilter === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return [start, now];
    }
    if (periodFilter === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return [start, now];
    }
    if (periodFilter === 'custom' && customRange) {
      return [customRange[0].startOf('day').toDate(), customRange[1].endOf('day').toDate()];
    }
    return null;
  };

  const filteredAlerts = useMemo(() => {
    const range = getPeriodRange();
    return alerts.filter((alert) => {
      if (severityFilter && alert.severity !== severityFilter) return false;
      if (categoryFilter && alert.category !== categoryFilter) return false;
      if (range) {
        const t = new Date(alert.occurredAt).getTime();
        if (t < range[0].getTime() || t > range[1].getTime()) return false;
      }
      return true;
    });
  }, [alerts, severityFilter, categoryFilter, periodFilter, customRange]);

  const dangerCount = alerts.filter((alert) => alert.severity === 'danger').length;
  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  const infoCount = alerts.filter((alert) => alert.severity === 'info').length;

  const columns = [
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      key: 'severity',
      width: 130,
      ellipsis: true,
      render: (severity: AlertItem['severity']) => {
        if (severity === 'danger') return <Tag color="red">Nguy hiểm</Tag>;
        if (severity === 'warning') return <Tag color="orange">Cảnh báo</Tag>;
        return <Tag color="blue">Thông tin</Tag>;
      },
    },
    {
      title: 'Loại',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      ellipsis: true,
      render: (category: string) => {
        const labels: Record<string, string> = {
          parking: 'Đỗ xe',
          package: 'Gói dịch vụ',
          zone: 'Khu bãi',
          payment: 'Thanh toán',
          revenue: 'Doanh thu',
          system: 'Hệ thống',
        };
        return <Tag>{labels[category] ?? category}</Tag>;
      },
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      ellipsis: true,
      render: (title: string, record: AlertItem) => (
        <span style={{ fontWeight: 600 }}>
          {title}
          {record.smartLevel === 'rule_based' && (
            <Tag color="purple" icon={<BulbOutlined />} style={{ marginLeft: 8 }}>Smart</Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
      render: (description: string, record: AlertItem) => (
        <div>
          <div>{description}</div>
          {record.suggestedAction && (
            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: 4 }}>
              💡 Gợi ý: {record.suggestedAction}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thời gian',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 180,
      ellipsis: true,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: (_: unknown, record: AlertItem) => (
        <Button size="small" onClick={() => record.relatedPath && navigate(record.relatedPath)}>
          Xem
        </Button>
      ),
    },
  ];

  const listTab = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Nguy hiểm"
              value={dangerCount}
              prefix={<FireOutlined style={{ color: 'var(--error)' }} />}
              valueStyle={{ color: 'var(--error)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Cảnh báo"
              value={warningCount}
              prefix={<ExclamationCircleOutlined style={{ color: 'var(--warning)' }} />}
              valueStyle={{ color: 'var(--warning)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Thông tin"
              value={infoCount}
              prefix={<CheckCircleOutlined style={{ color: 'var(--info)' }} />}
              valueStyle={{ color: 'var(--info)' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CalendarOutlined style={{ color: 'var(--on-surface-variant)' }} />
          <Segmented
            value={periodFilter}
            onChange={(v) => { setPeriodFilter(v as PeriodKey); if (v !== 'custom') setCustomRange(null); }}
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: 'Hôm nay', value: 'today' },
              { label: '7 ngày', value: '7days' },
              { label: '30 ngày', value: '30days' },
              { label: 'Tháng này', value: 'thisMonth' },
              { label: 'Tùy chọn', value: 'custom' },
            ]}
          />
          {periodFilter === 'custom' && (
            <RangePicker
              format="DD/MM/YYYY"
              value={customRange}
              onChange={(dates) => setCustomRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null)}
              style={{ width: 260 }}
            />
          )}
          {periodFilter !== 'all' && (
            <span style={{ fontSize: 12, color: 'var(--outline)' }}>
              Hiển thị {filteredAlerts.length} / {alerts.length} cảnh báo
            </span>
          )}
        </div>
        <div className="toolbar">
          <Space wrap>
            <InputNumber
              min={1}
              value={longParkingHours}
              onChange={(value) => setLongParkingHours(value ?? 24)}
              addonBefore="Xe đỗ quá"
              addonAfter="giờ"
            />
            <Select
              value={severityFilter}
              allowClear
              placeholder="Lọc mức độ"
              style={{ width: 150 }}
              onChange={setSeverityFilter}
              options={[
                { value: 'danger', label: '🔴 Nguy hiểm' },
                { value: 'warning', label: '🟠 Cảnh báo' },
                { value: 'info', label: '🔵 Thông tin' },
              ]}
            />
            <Select
              value={categoryFilter}
              allowClear
              placeholder="Lọc loại"
              style={{ width: 150 }}
              onChange={setCategoryFilter}
              options={Array.from(new Set(alerts.map((a) => a.category))).map((cat) => ({
                value: cat,
                label: { parking: 'Đỗ xe', package: 'Gói dịch vụ', zone: 'Khu bãi', payment: 'Thanh toán', system: 'Hệ thống' }[cat] ?? cat,
              }))}
            />
            <Tooltip title="Xóa bộ lọc & tải lại">
              <Button icon={<ReloadOutlined />} onClick={() => {
                setSeverityFilter(undefined);
                setCategoryFilter(undefined);
                setPeriodFilter('all');
                setCustomRange(null);
                fetchAlerts();
              }}>
                Làm mới
              </Button>
            </Tooltip>
          </Space>

          <div style={{ marginLeft: 'auto' }}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'excel',
                    icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
                    label: 'Xuất Excel (.xlsx)',
                    onClick: () => {
                      if (filteredAlerts.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportAlertsExcel(filteredAlerts, longParkingHours);
                      message.success(`Đã xuất ${filteredAlerts.length} cảnh báo ra Excel`);
                    },
                  },
                  {
                    key: 'csv',
                    icon: <FileTextOutlined style={{ color: 'var(--secondary)' }} />,
                    label: 'Xuất CSV',
                    onClick: () => {
                      if (filteredAlerts.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportAlertsCsv(filteredAlerts);
                      message.success(`Đã xuất ${filteredAlerts.length} cảnh báo ra CSV`);
                    },
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>
                Xuất báo cáo
              </Button>
            </Dropdown>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredAlerts}
          rowKey="id"
          loading={loading}
          pagination={defaultPagination({ pageSize: 10 })}
          locale={{
            emptyText: (
              <div style={{ padding: 32, color: 'var(--on-surface-variant)' }}>
                <AlertOutlined style={{ marginRight: 8 }} />
                Chưa phát hiện bất thường theo bộ lọc hiện tại
              </div>
            ),
          }}
        />
      </Card>
    </>
  );

  return (
    <div>
      <h2 className="page-title">{t('pageAlerts')}</h2>
      <Tabs
        defaultActiveKey="list"
        items={[
          { key: 'list', label: <><UnorderedListOutlined /> Danh sách cảnh báo</>, children: listTab },
          { key: 'settings', label: <><SettingOutlined /> Cấu hình mức độ</>, children: <AlertSettingsPanel /> },
          { key: 'expert-system', label: <><ExperimentOutlined /> Cấu hình nâng cao</>, children: <ExpertRulesPanel /> },
        ]}
      />
    </div>
  );
};

export default Alerts;
