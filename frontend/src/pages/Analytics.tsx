import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Segmented, Table, Progress, Collapse, Tag, message, Spin, Empty } from 'antd';
import { BulbOutlined, WarningOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import api from '../api/axios';
import { AnalyticsInsights } from '../types';
import PageHeader from '../components/PageHeader';
import { chartColor } from '../utils/chartTheme';

type PeriodKey = 'month' | 'quarter' | 'year';

const fmt = (v: number) => Number(v || 0).toLocaleString('vi-VN');

const Analytics: React.FC = () => {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [data, setData] = useState<AnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<AnalyticsInsights>('/analytics/insights', { params: { period } })
      .then((res) => setData(res.data))
      .catch(() => message.error('Không tải được dữ liệu phân tích'))
      .finally(() => setLoading(false));
  }, [period]);

  const zoneColumns = useMemo(() => [
    { title: 'Khu vực', dataIndex: 'zone', key: 'zone', width: 140, ellipsis: true },
    { title: 'Tổng chỗ', dataIndex: 'totalSpots', key: 'totalSpots', width: 90 },
    {
      title: 'Tỷ lệ lấp đầy', dataIndex: 'avgOccupancy', key: 'avgOccupancy', width: 200,
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={v >= 80 ? 'var(--error)' : v >= 60 ? 'var(--warning)' : 'var(--success)'}
        />
      ),
    },
    {
      title: 'Doanh thu', dataIndex: 'revenue', key: 'revenue', width: 150, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}đ</span>,
    },
    {
      title: 'DT/chỗ', dataIndex: 'revenuePerSpot', key: 'revenuePerSpot', width: 150, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}đ</span>,
    },
  ], []);

  if (loading && !data) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <PageHeader />

      <Card style={{ marginBottom: 16 }}>
        <Segmented
          value={period}
          onChange={(v) => setPeriod(v as PeriodKey)}
          options={[
            { label: 'Tháng gần nhất', value: 'month' },
            { label: 'Quý gần nhất', value: 'quarter' },
            { label: 'Năm gần nhất', value: 'year' },
          ]}
        />
      </Card>

      {!data ? (
        <Empty description="Chưa có dữ liệu" />
      ) : (
        <Spin spinning={loading}>
          <Row gutter={[14, 14]}>
            <Col xs={24} lg={12}>
              <Card title="Lượt xe theo ngày trong tuần">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.dayOfWeekAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ReTooltip formatter={(v: number, name: string) => name === 'avgVehicles' ? [v, 'Lượt xe TB'] : [`${fmt(v)}đ`, 'Doanh thu TB']} />
                    <Bar dataKey="avgVehicles" fill={chartColor.primary()} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Lượt xe theo giờ trong ngày">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.hourlyAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} />
                    <YAxis />
                    <ReTooltip labelFormatter={(h) => `${h}h`} formatter={(v: number) => [v, 'Lượt xe TB']} />
                    <Line type="monotone" dataKey="avgVehicles" stroke={chartColor.success()} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Card title="Hiệu quả theo khu vực" style={{ marginTop: 14 }}>
            <Table columns={zoneColumns} dataSource={data.zoneEfficiency} rowKey="zone" pagination={false} size="small" />
          </Card>

          <Card
            title={<span><BulbOutlined style={{ color: 'var(--warning)' }} /> Gợi ý quyết định <Tag color="purple">DSS</Tag></span>}
            style={{ marginTop: 14 }}
          >
            {data.decisions.length === 0 ? (
              <Empty description="Chưa có gợi ý quyết định nào trong kỳ này — vận hành ổn định" />
            ) : (
              <Collapse
                defaultActiveKey={data.decisions.map((d) => d.id)}
                items={data.decisions.map((d) => ({
                  key: d.id,
                  label: <span style={{ fontWeight: 600 }}><WarningOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />{d.question}</span>,
                  children: (
                    <div>
                      <p style={{ color: 'var(--on-surface-variant)', marginBottom: 16 }}>{d.analysis}</p>
                      <Table
                        pagination={false}
                        size="small"
                        rowKey="action"
                        dataSource={d.options}
                        columns={[
                          { title: 'Phương án', dataIndex: 'action', key: 'action', width: '30%' },
                          { title: 'Tác động dự kiến', dataIndex: 'estimatedImpact', key: 'estimatedImpact' },
                          { title: 'Rủi ro', dataIndex: 'risk', key: 'risk' },
                        ]}
                      />
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Spin>
      )}
    </div>
  );
};

export default Analytics;
