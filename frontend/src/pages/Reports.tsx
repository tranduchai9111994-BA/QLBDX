import React, { useState, useEffect } from 'react';
import { Card, DatePicker, Row, Col, Table, message, Select, Statistic, Radio } from 'antd';
import { DollarOutlined, CarOutlined, RiseOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import api from '../api/axios';
import { RevenueReport, VehicleStats } from '../types';

const { RangePicker } = DatePicker;
const PIE_COLORS = ['#005daa', '#1a7a2e', '#934600', '#ba1a1a', '#6750a4'];

type GroupBy = 'day' | 'month' | 'year';

function autoGroupBy(from: Dayjs, to: Dayjs): GroupBy {
  const days = to.diff(from, 'day');
  if (days > 365) return 'month';
  if (days > 60) return 'month';
  return 'day';
}

function formatPeriodLabel(period: string, groupBy: GroupBy): string {
  if (groupBy === 'year') return period;
  if (groupBy === 'month') return dayjs(period + '-01').format('MM/YYYY');
  return dayjs(period).format('DD/MM');
}

const Reports: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('year'),
    dayjs(),
  ]);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [revenue, setRevenue] = useState<RevenueReport[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {
        fromDate: dateRange[0].format('YYYY-MM-DD'),
        toDate: dateRange[1].format('YYYY-MM-DD'),
        groupBy,
      };
      const [revRes, vehRes] = await Promise.all([
        api.get<RevenueReport[]>('/reports/revenue', { params }),
        api.get<VehicleStats[]>('/reports/vehicle-stats', { params: { fromDate: params.fromDate, toDate: params.toDate } }),
      ]);
      setRevenue(revRes.data);
      setVehicleStats(vehRes.data);
    } catch {
      message.error('Lỗi tải báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [dateRange, groupBy]);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      const newRange: [Dayjs, Dayjs] = [dates[0], dates[1]];
      setDateRange(newRange);
      setGroupBy(autoGroupBy(newRange[0], newRange[1]));
    }
  };

  const totalRevenue = revenue.reduce((s, r) => s + Number(r.totalRevenue), 0);
  const totalTransactions = revenue.reduce((s, r) => s + Number(r.totalTransactions), 0);
  const totalParkingRev = revenue.reduce((s, r) => s + Number(r.parkingRevenue), 0);
  const totalPackageRev = revenue.reduce((s, r) => s + Number(r.packageRevenue), 0);
  const totalVehicles = vehicleStats.reduce((s, v) => s + v.totalRecords, 0);

  const chartData = revenue.map((r) => ({
    period: formatPeriodLabel(r.period, groupBy),
    'Tổng DT': Math.round(Number(r.totalRevenue)),
    'Gửi lẻ': Math.round(Number(r.parkingRevenue)),
    'Vé tháng': Math.round(Number(r.packageRevenue)),
    transactions: Number(r.totalTransactions),
  }));

  const revenueColumns = [
    {
      title: groupBy === 'year' ? 'Năm' : groupBy === 'month' ? 'Tháng' : 'Ngày',
      dataIndex: 'period',
      key: 'period',
      render: (d: string) => formatPeriodLabel(d, groupBy),
    },
    {
      title: 'Gửi lẻ (đ)',
      dataIndex: 'parkingRevenue',
      key: 'parkingRevenue',
      render: (v: number) => Number(v).toLocaleString(),
      align: 'right' as const,
    },
    {
      title: 'Vé tháng (đ)',
      dataIndex: 'packageRevenue',
      key: 'packageRevenue',
      render: (v: number) => Number(v).toLocaleString(),
      align: 'right' as const,
    },
    {
      title: 'Tổng (đ)',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      render: (v: number) => (
        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{Number(v).toLocaleString()}</span>
      ),
      align: 'right' as const,
    },
    {
      title: 'Số GD',
      dataIndex: 'totalTransactions',
      key: 'totalTransactions',
      align: 'right' as const,
    },
  ];

  const vehicleColumns = [
    { title: 'Loại xe', dataIndex: 'vehicleType', key: 'vehicleType' },
    {
      title: 'Số lượt',
      dataIndex: 'totalRecords',
      key: 'totalRecords',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v.toLocaleString()}</span>,
      align: 'right' as const,
    },
    {
      title: 'Doanh thu (đ)',
      dataIndex: 'totalFees',
      key: 'totalFees',
      render: (v: number) => Number(v).toLocaleString(),
      align: 'right' as const,
    },
  ];

  const quickRanges = [
    { label: 'Tháng này', range: [dayjs().startOf('month'), dayjs()] as [Dayjs, Dayjs], group: 'day' as GroupBy },
    { label: 'Quý này', range: [dayjs().subtract(2, 'month').startOf('month'), dayjs()] as [Dayjs, Dayjs], group: 'month' as GroupBy },
    { label: 'Năm nay', range: [dayjs().startOf('year'), dayjs()] as [Dayjs, Dayjs], group: 'month' as GroupBy },
    { label: '2025', range: [dayjs('2025-01-01'), dayjs('2025-12-31')] as [Dayjs, Dayjs], group: 'month' as GroupBy },
    { label: '2024', range: [dayjs('2024-01-01'), dayjs('2024-12-31')] as [Dayjs, Dayjs], group: 'month' as GroupBy },
    { label: 'Toàn bộ', range: [dayjs('2024-01-01'), dayjs()] as [Dayjs, Dayjs], group: 'month' as GroupBy },
  ];

  return (
    <div>
      <h2 className="page-title">Báo cáo thống kê</h2>

      {/* Toolbar */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <RangePicker
          format="DD/MM/YYYY"
          value={dateRange}
          onChange={handleDateChange}
          placeholder={['Từ ngày', 'Đến ngày']}
        />
        <Select
          value={groupBy}
          onChange={(v) => setGroupBy(v)}
          style={{ width: 130 }}
          options={[
            { value: 'day', label: 'Nhóm theo ngày' },
            { value: 'month', label: 'Nhóm theo tháng' },
            { value: 'year', label: 'Nhóm theo năm' },
          ]}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {quickRanges.map((q) => (
            <button
              key={q.label}
              onClick={() => { setDateRange(q.range); setGroupBy(q.group); }}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--outline)',
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--on-surface)',
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-info">
            <Statistic
              title="Tổng doanh thu"
              value={totalRevenue}
              suffix="đ"
              prefix={<DollarOutlined style={{ color: '#005daa' }} />}
              valueStyle={{ color: '#005daa', fontSize: '1.3rem', fontWeight: 700 }}
              formatter={(v) => Number(v).toLocaleString()}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-success">
            <Statistic
              title="Gửi lẻ"
              value={totalParkingRev}
              suffix="đ"
              prefix={<CarOutlined style={{ color: '#1a7a2e' }} />}
              valueStyle={{ color: '#1a7a2e', fontSize: '1.3rem', fontWeight: 700 }}
              formatter={(v) => Number(v).toLocaleString()}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-warning">
            <Statistic
              title="Vé tháng/quý/năm"
              value={totalPackageRev}
              suffix="đ"
              prefix={<RiseOutlined style={{ color: '#934600' }} />}
              valueStyle={{ color: '#934600', fontSize: '1.3rem', fontWeight: 700 }}
              formatter={(v) => Number(v).toLocaleString()}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card stat-error">
            <Statistic
              title="Tổng lượt xe"
              value={totalVehicles}
              prefix={<BarChartOutlined style={{ color: '#ba1a1a' }} />}
              valueStyle={{ color: '#ba1a1a', fontSize: '1.3rem', fontWeight: 700 }}
              formatter={(v) => Number(v).toLocaleString()}
            />
            <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4 }}>
              {totalTransactions.toLocaleString()} giao dịch
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Main revenue chart */}
        <Col xs={24} lg={16}>
          <Card
            className="chart-card"
            title="Doanh thu theo kỳ"
            loading={loading}
            extra={
              <Radio.Group size="small" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                <Radio.Button value="bar">Cột</Radio.Button>
                <Radio.Button value="line">Đường</Radio.Button>
              </Radio.Group>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }}
                    formatter={(v: number) => `${Number(v).toLocaleString()}đ`}
                  />
                  <Legend />
                  <Bar dataKey="Gửi lẻ" stackId="rev" fill="#005daa" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Vé tháng" stackId="rev" fill="#1a7a2e" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }}
                    formatter={(v: number) => `${Number(v).toLocaleString()}đ`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="Tổng DT" stroke="#005daa" strokeWidth={2} dot={chartData.length <= 24} />
                  <Line type="monotone" dataKey="Gửi lẻ" stroke="#1a7a2e" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  <Line type="monotone" dataKey="Vé tháng" stroke="#934600" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Vehicle type pie */}
        <Col xs={24} lg={8}>
          <Card title="Phân loại xe" loading={loading} style={{ height: '100%' }}>
            {vehicleStats.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={vehicleStats}
                      dataKey="totalRecords"
                      nameKey="vehicleType"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      label={({ vehicleType, percent }) => `${vehicleType} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {vehicleStats.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name) => [`${v.toLocaleString()} lượt`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <Table
                  columns={vehicleColumns}
                  dataSource={vehicleStats}
                  rowKey="vehicleType"
                  pagination={false}
                  size="small"
                  style={{ marginTop: 8 }}
                />
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>
                Không có dữ liệu
              </div>
            )}
          </Card>
        </Col>

        {/* Revenue detail table */}
        <Col xs={24}>
          <Card title={`Chi tiết doanh thu (${revenue.length} kỳ)`} loading={loading}>
            <Table
              columns={revenueColumns}
              dataSource={revenue}
              rowKey="period"
              pagination={{ pageSize: 24, showSizeChanger: false }}
              size="small"
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--surface-container)' }}>
                    <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">{totalParkingRev.toLocaleString()}</Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">{totalPackageRev.toLocaleString()}</Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><span style={{ color: 'var(--primary)' }}>{totalRevenue.toLocaleString()}</span></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">{totalTransactions.toLocaleString()}</Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;
