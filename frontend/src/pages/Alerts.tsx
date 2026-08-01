import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Select, InputNumber, Row, Col, Statistic, Space, message } from 'antd';
import { AlertOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FireOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AlertItem } from '../types';

const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [longParkingHours, setLongParkingHours] = useState(24);
  const [severityFilter, setSeverityFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

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

  const filteredAlerts = useMemo(() => alerts.filter((alert) => {
    if (severityFilter && alert.severity !== severityFilter) return false;
    if (categoryFilter && alert.category !== categoryFilter) return false;
    return true;
  }), [alerts, severityFilter, categoryFilter]);

  const dangerCount = alerts.filter((alert) => alert.severity === 'danger').length;
  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  const infoCount = alerts.filter((alert) => alert.severity === 'info').length;

  const columns = [
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      key: 'severity',
      width: 130,
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
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <span style={{ fontWeight: 600 }}>{title}</span>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Thời gian',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
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

  return (
    <div>
      <h2 className="page-title">Cảnh báo bất thường</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Nguy hiểm"
              value={dangerCount}
              prefix={<FireOutlined style={{ color: '#ba1a1a' }} />}
              valueStyle={{ color: '#ba1a1a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Cảnh báo"
              value={warningCount}
              prefix={<ExclamationCircleOutlined style={{ color: '#934600' }} />}
              valueStyle={{ color: '#934600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Thông tin"
              value={infoCount}
              prefix={<CheckCircleOutlined style={{ color: '#005daa' }} />}
              valueStyle={{ color: '#005daa' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
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
              placeholder="Lọc theo mức độ"
              style={{ width: 180 }}
              onChange={setSeverityFilter}
              options={[
                { value: 'danger', label: 'Nguy hiểm' },
                { value: 'warning', label: 'Cảnh báo' },
                { value: 'info', label: 'Thông tin' },
              ]}
            />
            <Select
              value={categoryFilter}
              allowClear
              placeholder="Lọc theo loại"
              style={{ width: 180 }}
              onChange={setCategoryFilter}
              options={Array.from(new Set(alerts.map((alert) => alert.category))).map((category) => ({
                value: category,
                label: category,
              }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => { setSeverityFilter(undefined); setCategoryFilter(undefined); fetchAlerts(); }}>
              Làm mới
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredAlerts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
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
    </div>
  );
};

export default Alerts;
