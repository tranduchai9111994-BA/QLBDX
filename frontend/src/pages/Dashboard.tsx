import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, Empty } from 'antd';
import { CarOutlined, DollarOutlined, EnvironmentOutlined, LoginOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api/axios';
import { DashboardStats, VehicleStats, HourlyStats } from '../types';

const COLORS = ['#005daa', '#1a7a2e', '#934600', '#ba1a1a', '#6750a4'];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const toDate = new Date();
        const fromDate = new Date(toDate);
        fromDate.setDate(fromDate.getDate() - 30);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const [dashboard, vStats, hStats] = await Promise.all([
          api.get<DashboardStats>('/reports/dashboard'),
          api.get<VehicleStats[]>('/reports/vehicle-stats', { params: { fromDate: fmt(fromDate), toDate: fmt(toDate) } }),
          api.get<HourlyStats[]>('/reports/hourly-stats'),
        ]);
        setData(dashboard.data);
        setVehicleStats(vStats.data);
        setHourlyStats(hStats.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const hasHourlyData = hourlyStats.length > 0;
  const hasVehicleData = vehicleStats.length > 0;

  return (
    <div>
      <h2 className="page-title">Tong quan</h2>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-info">
            <Statistic
              title="Xe dang do"
              value={data?.currentlyParked || 0}
              prefix={<CarOutlined style={{ color: '#005daa' }} />}
              valueStyle={{ color: '#005daa', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-success">
            <Statistic
              title="Cho trong"
              value={data?.availableSpots || 0}
              suffix={<span style={{ fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>/ {data?.totalSpots || 0}</span>}
              prefix={<EnvironmentOutlined style={{ color: '#1a7a2e' }} />}
              valueStyle={{ color: '#1a7a2e', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-warning">
            <Statistic
              title="Luot xe hom nay"
              value={data?.todayEntries || 0}
              prefix={<LoginOutlined style={{ color: '#934600' }} />}
              valueStyle={{ color: '#934600', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-error">
            <Statistic
              title="Doanh thu hom nay"
              value={data?.todayRevenue || 0}
              prefix={<DollarOutlined style={{ color: '#ba1a1a' }} />}
              suffix="d"
              valueStyle={{ color: '#ba1a1a', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 8 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: '#6750a4', borderRadius: '0 2px 2px 0' }} />
            <Statistic
              title="Doanh thu thang"
              value={data?.monthRevenue || 0}
              suffix="d"
              valueStyle={{ color: '#6750a4', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="Luot xe theo gio hom nay">
            {hasHourlyData ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} stroke="var(--on-surface-variant)" fontSize={12} />
                  <YAxis stroke="var(--on-surface-variant)" fontSize={12} />
                  <Tooltip
                    labelFormatter={(h) => `${h}:00`}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)', fontFamily: 'Inter' }}
                  />
                  <Bar dataKey="count" fill="#005daa" name="Luot xe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="Chua co luot xe nao hom nay" />
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="chart-card" title="Thống kê theo loại xe (30 ngày qua)">
            {hasVehicleData ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={vehicleStats} dataKey="totalRecords" nameKey="vehicleType" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ vehicleType, totalRecords }) => `${vehicleType}: ${totalRecords}`}>
                    {vehicleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="Chua co du lieu xe hoan tat trong thang nay" />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
