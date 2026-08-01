import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Spin, Empty, Alert, List, message, Tag } from 'antd';
import { CarOutlined, DollarOutlined, EnvironmentOutlined, LoginOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api/axios';
import { CustomerPackage, DashboardStats, HourlyStats, ParkingRecord, ParkingSpot, VehicleStats } from '../types';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#005daa', '#1a7a2e', '#934600', '#ba1a1a', '#6750a4'];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value);

type ZoneWarning = {
  name: string;
  available: number;
  total: number;
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [parkedRecords, setParkedRecords] = useState<ParkingRecord[]>([]);
  const [expiringPackages, setExpiringPackages] = useState<CustomerPackage[]>([]);
  const [nearFullZones, setNearFullZones] = useState<ZoneWarning[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [parkedRes, spotsRes, packagesRes] = await Promise.all([
          api.get<ParkingRecord[]>('/parking', { params: { status: 'parked' } }),
          api.get<ParkingSpot[]>('/parking-spots'),
          api.get<CustomerPackage[]>('/customer-packages'),
        ]);

        setParkedRecords(parkedRes.data);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setExpiringPackages(
          packagesRes.data.filter((pkg) => {
            if (pkg.status !== 'active') {
              return false;
            }

            const endDate = new Date(pkg.endDate);
            const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
          })
        );

        const zoneMap = new Map<string, ZoneWarning>();
        spotsRes.data.forEach((spot) => {
          const zoneName = spot.zone?.name || 'Chưa phân khu';
          const existing = zoneMap.get(zoneName) || { name: zoneName, available: 0, total: 0 };
          existing.total += 1;
          if (spot.status === 'available') {
            existing.available += 1;
          }
          zoneMap.set(zoneName, existing);
        });

        setNearFullZones(
          Array.from(zoneMap.values()).filter((zone) => zone.total > 0 && (zone.available <= 2 || zone.available / zone.total <= 0.1))
        );

        if (!isAdmin) {
          setData({
            currentlyParked: parkedRes.data.length,
            totalSpots: spotsRes.data.length,
            availableSpots: spotsRes.data.filter((spot) => spot.status === 'available').length,
            occupiedSpots: spotsRes.data.filter((spot) => spot.status === 'occupied').length,
            todayEntries: 0,
            todayRevenue: 0,
            monthRevenue: 0,
          });
          setVehicleStats([]);
          setHourlyStats([]);
          return;
        }

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
        message.error('Không tải được dữ liệu tổng quan');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const hasHourlyData = hourlyStats.length > 0;
  const hasVehicleData = vehicleStats.length > 0;

  return (
    <div>
      <h2 className="page-title">Tổng quan</h2>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-info">
            <Statistic
              title="XE ĐANG ĐỖ"
              value={data?.currentlyParked || 0}
              prefix={<CarOutlined style={{ color: '#005daa' }} />}
              valueStyle={{ color: '#005daa', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-success">
            <Statistic
              title="CHỖ TRỐNG"
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
              title={isAdmin ? 'LƯỢT XE HÔM NAY' : 'GÓI SẮP HẾT HẠN'}
              value={isAdmin ? data?.todayEntries || 0 : expiringPackages.length}
              prefix={<LoginOutlined style={{ color: '#934600' }} />}
              valueStyle={{ color: '#934600', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card stat-error">
            <Statistic
              title={isAdmin ? 'DOANH THU HÔM NAY' : 'KHU SẮP ĐẦY'}
              value={isAdmin ? data?.todayRevenue || 0 : nearFullZones.length}
              formatter={(val) => isAdmin ? <>{formatCurrency(Number(val))} <span style={{ fontSize: '1rem' }}>đ</span></> : val}
              prefix={<DollarOutlined style={{ color: '#ba1a1a' }} />}
              valueStyle={{ color: '#ba1a1a', fontSize: '2rem', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {isAdmin && (
        <Row gutter={[24, 24]} style={{ marginTop: 8 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card" style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: '#6750a4', borderRadius: '0 2px 2px 0' }} />
              <Statistic
                title="DOANH THU THÁNG"
                value={data?.monthRevenue || 0}
                formatter={(val) => <>{formatCurrency(Number(val))} <span style={{ fontSize: '1rem' }}>đ</span></>}
                valueStyle={{ color: '#6750a4', fontSize: '2rem', fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Cảnh báo gói sắp hết hạn">
            {expiringPackages.length > 0 ? (
              <List
                dataSource={expiringPackages.slice(0, 6)}
                renderItem={(pkg) => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 16 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{pkg.vehicle?.licensePlate || 'Không rõ biển số'}</div>
                        <div style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
                          {pkg.customer?.fullName || 'Khách hàng'} • {pkg.parkingPackage?.name || 'Gói dịch vụ'}
                        </div>
                      </div>
                      <Tag color="orange">{new Date(pkg.endDate).toLocaleDateString('vi-VN')}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Alert type="success" showIcon message="Hiện chưa có gói nào sắp hết hạn trong 7 ngày tới" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Cảnh báo khu/bãi sắp đầy">
            {nearFullZones.length > 0 ? (
              <List
                dataSource={nearFullZones}
                renderItem={(zone) => (
                  <List.Item>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 16 }}>
                      <div style={{ fontWeight: 600 }}>{zone.name}</div>
                      <Tag color="red">
                        {zone.available}/{zone.total} chỗ trống
                      </Tag>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Alert type="success" showIcon message="Các khu vực vẫn còn đủ chỗ trống để vận hành" />
            )}
          </Card>
        </Col>
      </Row>

      {isAdmin && (
        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={12}>
            <Card className="chart-card" title="Lượt xe theo giờ hôm nay">
              {hasHourlyData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} stroke="var(--on-surface-variant)" fontSize={12} />
                    <YAxis stroke="var(--on-surface-variant)" fontSize={12} />
                    <Tooltip
                      labelFormatter={(h) => `${h}:00`}
                      formatter={(value: number) => [`${value} lượt`, 'Lượt xe']}
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)', fontFamily: 'Inter' }}
                    />
                    <Bar dataKey="count" fill="#005daa" name="Lượt xe" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty description="Chưa có lượt xe nào hôm nay" />
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
                  <Empty description="Chưa có dữ liệu xe hoàn tất trong tháng này" />
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Dashboard;
