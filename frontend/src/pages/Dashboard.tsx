import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Row, Col, Card, Statistic, Spin, Empty, Alert, List, message, Tag, Progress,
  Button, Space, Typography, Tooltip,
} from 'antd';
import {
  CarOutlined, DollarOutlined, EnvironmentOutlined, LoginOutlined,
  AlertOutlined, ArrowRightOutlined, ClockCircleOutlined, ThunderboltOutlined,
  DashboardOutlined, CheckCircleOutlined, ReloadOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, BulbOutlined, FieldTimeOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
  AlertItem, CustomerPackage, DashboardInsights, DashboardStats, HourlyStats,
  ParkingRecord, ParkingSpot, VehicleStats,
} from '../types';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#005daa', '#1a7a2e', '#934600', '#ba1a1a', '#6750a4', '#0075d5'];
const REFRESH_INTERVAL_MS = 90_000;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN').format(value);

type ZoneOccupancy = {
  name: string;
  available: number;
  occupied: number;
  maintenance: number;
  total: number;
  fillRate: number;
};

const hoursParked = (entryTime: string) => {
  const ms = Date.now() - new Date(entryTime).getTime();
  const hours = Math.max(0, Math.floor(ms / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days} ngày ${hours % 24}h`;
  }
  return `${hours}h ${mins}m`;
};

const hoursParkedRaw = (entryTime: string) => {
  const ms = Date.now() - new Date(entryTime).getTime();
  return ms / (1000 * 60 * 60);
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [parkedRecords, setParkedRecords] = useState<ParkingRecord[]>([]);
  const [expiringPackages, setExpiringPackages] = useState<CustomerPackage[]>([]);
  const [zones, setZones] = useState<ZoneOccupancy[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAdmin = user?.role === 'admin';

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
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
          if (pkg.status !== 'active') return false;
          const endDate = new Date(pkg.endDate);
          const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7;
        })
      );

      const zoneMap = new Map<string, ZoneOccupancy>();
      spotsRes.data.forEach((spot) => {
        const zoneName = spot.zone?.name || 'Chưa phân khu';
        const existing = zoneMap.get(zoneName) || {
          name: zoneName, available: 0, occupied: 0, maintenance: 0, total: 0, fillRate: 0,
        };
        existing.total += 1;
        if (spot.status === 'available') existing.available += 1;
        else if (spot.status === 'occupied') existing.occupied += 1;
        else existing.maintenance += 1;
        zoneMap.set(zoneName, existing);
      });

      const zoneList = Array.from(zoneMap.values()).map((z) => ({
        ...z,
        fillRate: z.total > 0 ? Math.round(((z.total - z.available) / z.total) * 100) : 0,
      }));
      setZones(zoneList.sort((a, b) => b.fillRate - a.fillRate));

      if (isAdmin) {
        const toDate = new Date();
        const fromDate = new Date(toDate);
        fromDate.setDate(fromDate.getDate() - 30);
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        const [dashboard, vStats, hStats, alertsRes, insightsRes] = await Promise.all([
          api.get<DashboardStats>('/reports/dashboard'),
          api.get<VehicleStats[]>('/reports/vehicle-stats', { params: { fromDate: fmt(fromDate), toDate: fmt(toDate) } }),
          api.get<HourlyStats[]>('/reports/hourly-stats'),
          api.get<AlertItem[]>('/reports/alerts', { params: { longParkingHours: 24 } }),
          api.get<DashboardInsights>('/reports/insights'),
        ]);
        setData(dashboard.data);
        setVehicleStats(vStats.data);
        setHourlyStats(hStats.data);
        setAlerts(alertsRes.data);
        setInsights(insightsRes.data);
      } else {
        setData({
          currentlyParked: parkedRes.data.length,
          totalSpots: spotsRes.data.length,
          availableSpots: spotsRes.data.filter((s) => s.status === 'available').length,
          occupiedSpots: spotsRes.data.filter((s) => s.status === 'occupied').length,
          todayEntries: 0,
          todayRevenue: 0,
          monthRevenue: 0,
        });
        setVehicleStats([]);
        setHourlyStats([]);
        setAlerts([]);
        setInsights(null);
      }

      setLastUpdated(new Date());
    } catch {
      if (!silent) message.error('Không tải được dữ liệu tổng quan');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData(false);
    timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  const occupancyRate = useMemo(() => {
    if (!data?.totalSpots) return 0;
    return Math.round(((data.totalSpots - data.availableSpots) / data.totalSpots) * 100);
  }, [data]);

  const hourlyChartData = useMemo(() => {
    const map = new Map(hourlyStats.map((h) => [h.hour, h.count]));
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: map.get(hour) || 0,
    }));
  }, [hourlyStats]);

  const peakHour = useMemo(() => {
    if (!hourlyStats.length) return null;
    return hourlyStats.reduce((best, cur) => (cur.count > best.count ? cur : best), hourlyStats[0]);
  }, [hourlyStats]);

  const nearFullZones = zones.filter((z) => z.total > 0 && (z.available <= 2 || z.available / z.total <= 0.1));
  const dangerAlerts = alerts.filter((a) => a.severity === 'danger').length;
  const warningAlerts = alerts.filter((a) => a.severity === 'warning').length;

  const sortedParked = useMemo(() =>
    [...parkedRecords].sort((a, b) =>
      new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    ), [parkedRecords]);

  const longParkedCount = sortedParked.filter((r) => hoursParkedRaw(r.entryTime) >= 8).length;

  const nowLabel = new Date().toLocaleString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const occupancyColor = occupancyRate >= 90 ? '#ba1a1a' : occupancyRate >= 70 ? '#934600' : '#1a7a2e';

  return (
    <div className="dashboard-page">
      {/* ── HERO ── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-main">
          <div className="dashboard-hero-eyebrow">
            <DashboardOutlined /> Trung tâm vận hành bãi đỗ
          </div>
          <h2 className="dashboard-hero-title">
            Xin chào, {user?.fullName || 'người dùng'}
          </h2>
          <p className="dashboard-hero-sub">
            {nowLabel} · {isAdmin ? 'Toàn quyền quản trị' : 'Ca vận hành nhân viên'}
          </p>

          <div className="dashboard-hero-actions-row">
            <Space wrap size="small">
              <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/parking/entry')}>
                Xe vào
              </Button>
              <Button icon={<CarOutlined />} className="dashboard-quick-btn" onClick={() => navigate('/parking/exit')}>
                Xe ra
              </Button>
              <Button icon={<EnvironmentOutlined />} className="dashboard-quick-btn" onClick={() => navigate('/parking-spots')}>
                Sơ đồ bãi
              </Button>
              {isAdmin && (
                <Button
                  icon={<AlertOutlined />}
                  className="dashboard-quick-btn"
                  onClick={() => navigate('/alerts')}
                  danger={dangerAlerts > 0}
                >
                  Cảnh báo {alerts.length > 0 && `(${alerts.length})`}
                </Button>
              )}
            </Space>

            <Tooltip title={`Tự động làm mới mỗi 90 giây · Cập nhật lúc ${lastUpdatedLabel}`}>
              <Button
                size="small"
                icon={<ReloadOutlined spin={refreshing} />}
                className="dashboard-refresh-btn"
                onClick={() => fetchData(true)}
                loading={refreshing}
              >
                {lastUpdatedLabel}
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="dashboard-hero-meter">
          <div className="dashboard-meter-label">Tỷ lệ lấp đầy</div>
          <Progress
            type="dashboard"
            percent={occupancyRate}
            strokeColor={occupancyColor}
            trailColor="rgba(255,255,255,0.18)"
            gapDegree={70}
            size={140}
            format={(p) => (
              <div className="dashboard-meter-value">
                <strong>{p}%</strong>
                <span>{data?.availableSpots || 0}/{data?.totalSpots || 0} trống</span>
              </div>
            )}
          />
          <div className="dashboard-meter-hint">
            {occupancyRate >= 90 ? '🔴 Bãi gần đầy — ưu tiên giải phóng' :
              occupancyRate >= 70 ? '🟠 Mức cao — theo dõi khu nóng' :
                '🟢 Công suất ổn định'}
          </div>
          {nearFullZones.length > 0 && (
            <div className="dashboard-meter-near-full">
              <WarningOutlined /> {nearFullZones.length} khu sắp đầy
            </div>
          )}
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card stat-info dashboard-kpi">
            <Statistic
              title="Xe đang đỗ"
              value={data?.currentlyParked || 0}
              prefix={<CarOutlined style={{ color: '#005daa' }} />}
              valueStyle={{ color: '#005daa', fontWeight: 700 }}
            />
            <div className="dashboard-kpi-foot">
              {longParkedCount > 0
                ? <span className="kpi-warn"><WarningOutlined /> {longParkedCount} xe đỗ &gt;8 giờ</span>
                : 'Đang chiếm chỗ trong bãi'}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card stat-success dashboard-kpi">
            <Statistic
              title="Chỗ trống"
              value={data?.availableSpots || 0}
              suffix={<span className="dashboard-kpi-suffix">/ {data?.totalSpots || 0}</span>}
              prefix={<EnvironmentOutlined style={{ color: '#1a7a2e' }} />}
              valueStyle={{ color: '#1a7a2e', fontWeight: 700 }}
            />
            <div className="dashboard-kpi-foot">
              {nearFullZones.length > 0
                ? <span className="kpi-warn"><WarningOutlined /> {nearFullZones.length} khu sắp đầy</span>
                : 'Sẵn sàng tiếp nhận xe mới'}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card stat-warning dashboard-kpi">
            <Statistic
              title={isAdmin ? 'Lượt xe hôm nay' : 'Gói sắp hết hạn'}
              value={isAdmin ? data?.todayEntries || 0 : expiringPackages.length}
              prefix={<ThunderboltOutlined style={{ color: '#934600' }} />}
              valueStyle={{ color: '#934600', fontWeight: 700 }}
            />
            <div className="dashboard-kpi-foot">
              {isAdmin
                ? (peakHour && peakHour.count > 0
                  ? <><RiseOutlined /> Cao điểm {peakHour.hour}h ({peakHour.count} lượt)</>
                  : 'Chưa có dữ liệu giờ cao điểm')
                : 'Hết hạn trong 7 ngày tới'}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card stat-error dashboard-kpi">
            <Statistic
              title={isAdmin ? 'Doanh thu hôm nay' : 'Cảnh báo vận hành'}
              value={isAdmin ? data?.todayRevenue || 0 : nearFullZones.length + (longParkedCount > 0 ? 1 : 0)}
              formatter={(val) => (isAdmin
                ? <>{formatCurrency(Number(val))} <span className="dashboard-kpi-suffix">đ</span></>
                : `${val} mục`)}
              prefix={<DollarOutlined style={{ color: '#ba1a1a' }} />}
              valueStyle={{ color: '#ba1a1a', fontWeight: 700 }}
            />
            <div className="dashboard-kpi-foot">
              {isAdmin
                ? `Tháng: ${formatCurrency(data?.monthRevenue || 0)} đ`
                : (dangerAlerts > 0
                  ? <span className="kpi-warn"><AlertOutlined /> {dangerAlerts} nguy hiểm cần xử lý</span>
                  : 'Không có vấn đề nghiêm trọng')}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── SMART INSIGHTS (DSS) ── */}
      {isAdmin && insights && (
        <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
          <Col xs={24} lg={8}>
            <Card className="dashboard-panel" title="So sánh tuần này vs tuần trước">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Statistic
                  title="Doanh thu"
                  value={insights.weekComparison.changePercent.revenue}
                  precision={1}
                  suffix="%"
                  prefix={insights.weekComparison.changePercent.revenue >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: insights.weekComparison.changePercent.revenue >= 0 ? '#1a7a2e' : '#ba1a1a', fontSize: '1.1rem' }}
                />
                <Statistic
                  title="Lượt xe"
                  value={insights.weekComparison.changePercent.vehicles}
                  precision={1}
                  suffix="%"
                  prefix={insights.weekComparison.changePercent.vehicles >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: insights.weekComparison.changePercent.vehicles >= 0 ? '#1a7a2e' : '#ba1a1a', fontSize: '1.1rem' }}
                />
                <Statistic
                  title="TB thời gian đỗ"
                  value={insights.weekComparison.changePercent.avgDuration}
                  precision={1}
                  suffix="%"
                  prefix={insights.weekComparison.changePercent.avgDuration >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: insights.weekComparison.changePercent.avgDuration >= 0 ? '#1a7a2e' : '#ba1a1a', fontSize: '1.1rem' }}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card className="dashboard-panel" title={<><FieldTimeOutlined /> Giờ cao điểm (30 ngày)</>}>
              <div style={{ fontSize: '1rem', marginBottom: 12 }}>
                🌅 Sáng: <b>{insights.peakHours.morning.hour}h</b> (~{insights.peakHours.morning.avgCount} xe)
              </div>
              <div style={{ fontSize: '1rem' }}>
                🌇 Chiều: <b>{insights.peakHours.afternoon.hour}h</b> (~{insights.peakHours.afternoon.avgCount} xe)
              </div>
              <div style={{ marginTop: 16, fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                Loại xe phổ biến
              </div>
              {insights.topVehicleTypes.slice(0, 3).map((vt) => (
                <div key={vt.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: 4 }}>
                  <span>{vt.type}</span>
                  <span>{vt.count} ({vt.percent}%)</span>
                </div>
              ))}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card className="dashboard-panel" title={<><BulbOutlined style={{ color: 'var(--warning)' }} /> Gợi ý thông minh</>}>
              {insights.suggestions.length === 0 ? (
                <Empty description="Chưa có gợi ý nào — vận hành ổn định" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {insights.suggestions.map((s, idx) => (
                    <Alert
                      key={idx}
                      type={s.type.includes('down') || s.type.includes('warning') || s.type === 'long_parking' ? 'warning' : 'info'}
                      showIcon
                      message={s.message}
                      style={{ borderRadius: 8, fontSize: '0.85rem' }}
                    />
                  ))}
                </Space>
              )}
            </Card>
          </Col>
          <Col xs={24}>
            <Card className="dashboard-panel" title="Xu hướng 7 ngày gần nhất">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={insights.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <ReTooltip
                    labelFormatter={(d) => new Date(d).toLocaleDateString('vi-VN')}
                    formatter={(value: number, name: string) => name === 'revenue' ? [`${formatCurrency(value)}đ`, 'Doanh thu'] : [value, 'Lượt xe']}
                  />
                  <Legend formatter={(v) => v === 'vehicles' ? 'Lượt xe' : 'Doanh thu'} />
                  <Line yAxisId="left" type="monotone" dataKey="vehicles" stroke="#005daa" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#1a7a2e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── ZONE OCCUPANCY + ALERTS/PACKAGES ── */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} lg={14}>
          <Card
            className="dashboard-panel"
            title="Lấp đầy theo khu"
            extra={<Button type="link" size="small" onClick={() => navigate('/parking-spots')}>Chi tiết bãi <ArrowRightOutlined /></Button>}
          >
            {nearFullZones.length > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={`${nearFullZones.map((z) => z.name).join(', ')} đang sắp đầy — cân nhắc điều phối xe`}
                style={{ marginBottom: 14, borderRadius: 8 }}
              />
            )}
            {zones.length === 0 ? (
              <Empty description="Chưa có dữ liệu khu đỗ" />
            ) : (
              <div className="dashboard-zone-list">
                {zones.map((zone) => {
                  const statusColor = zone.fillRate >= 90 ? '#ba1a1a' : zone.fillRate >= 70 ? '#934600' : '#1a7a2e';
                  const tagColor = zone.fillRate >= 90 ? 'red' : zone.fillRate >= 70 ? 'orange' : 'green';
                  return (
                    <div key={zone.name} className="dashboard-zone-row">
                      <div className="dashboard-zone-head">
                        <div>
                          <strong>{zone.name}</strong>
                          <span className="dashboard-zone-meta">
                            {zone.occupied} đang dùng · {zone.available} trống
                            {zone.maintenance > 0 ? ` · ${zone.maintenance} bảo trì` : ''}
                          </span>
                        </div>
                        <Tag color={tagColor}>{zone.fillRate}%</Tag>
                      </div>
                      <Progress
                        percent={zone.fillRate}
                        showInfo={false}
                        strokeColor={statusColor}
                        trailColor="var(--surface-container)"
                        size={['100%', 10]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            className="dashboard-panel"
            title={isAdmin ? 'Cảnh báo ưu tiên' : 'Gói sắp hết hạn'}
            extra={isAdmin
              ? <Button type="link" size="small" onClick={() => navigate('/alerts')}>Xem tất cả <ArrowRightOutlined /></Button>
              : <Button type="link" size="small" onClick={() => navigate('/customer-packages')}>Quản lý <ArrowRightOutlined /></Button>}
          >
            {isAdmin ? (
              alerts.length > 0 ? (
                <List
                  dataSource={alerts.slice(0, 6)}
                  renderItem={(item) => (
                    <List.Item
                      className="dashboard-alert-item"
                      actions={[
                        <Button key="go" size="small" type="link" onClick={() => item.relatedPath && navigate(item.relatedPath)}>
                          Xem
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Tag color={item.severity === 'danger' ? 'red' : item.severity === 'warning' ? 'orange' : 'blue'}>
                            {item.severity === 'danger' ? '🔴' : item.severity === 'warning' ? '🟠' : '🔵'}
                          </Tag>
                        }
                        title={<span style={{ fontSize: '0.88rem' }}>{item.title}</span>}
                        description={<Typography.Text type="secondary" ellipsis style={{ fontSize: '0.8rem' }}>{item.description}</Typography.Text>}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="Không có cảnh báo bất thường" />
              )
            ) : (
              expiringPackages.length > 0 ? (
                <List
                  dataSource={expiringPackages.slice(0, 6)}
                  renderItem={(pkg) => {
                    const daysLeft = Math.ceil(
                      (new Date(pkg.endDate).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <List.Item>
                        <div className="dashboard-list-row">
                          <div>
                            <div className="dashboard-list-title">{pkg.vehicle?.licensePlate || '—'}</div>
                            <div className="dashboard-list-sub">
                              {pkg.customer?.fullName} · {pkg.parkingPackage?.name}
                            </div>
                          </div>
                          <Tag color={daysLeft <= 2 ? 'red' : 'orange'}>
                            {daysLeft <= 0 ? 'Hôm nay' : `còn ${daysLeft} ngày`}
                          </Tag>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Alert type="success" showIcon message="Không có gói hết hạn trong 7 ngày" />
              )
            )}
          </Card>
        </Col>
      </Row>

      {/* ── PARKED VEHICLES ── */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24}>
          <Card
            className="dashboard-panel"
            title={
              <Space>
                <span>Xe đang trong bãi</span>
                <Tag color="blue">{parkedRecords.length} xe</Tag>
                {longParkedCount > 0 && (
                  <Tag color="orange"><WarningOutlined /> {longParkedCount} xe đỗ &gt;8h</Tag>
                )}
              </Space>
            }
            extra={<Button type="link" size="small" onClick={() => navigate('/parking/exit')}>Xe ra <ArrowRightOutlined /></Button>}
          >
            {parkedRecords.length > 0 ? (
              <Row gutter={[12, 4]}>
                {sortedParked.slice(0, 16).map((record) => {
                  const hrs = hoursParkedRaw(record.entryTime);
                  const isLong = hrs >= 8;
                  const isVeryLong = hrs >= 24;
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={record.id}>
                      <div className={`dashboard-parked-item ${isVeryLong ? 'parked-critical' : isLong ? 'parked-long' : ''}`}>
                        <div className="dashboard-parked-plate">{record.licensePlate}</div>
                        <div className="dashboard-parked-meta">
                          <span>{record.vehicleType?.name || '—'}</span>
                          {record.parkingSpot && (
                            <span> · {record.parkingSpot.zone?.name || ''} {record.parkingSpot.spotNumber}</span>
                          )}
                        </div>
                        <div className="dashboard-parked-time">
                          <ClockCircleOutlined style={{ fontSize: 11 }} />
                          {' '}{hoursParked(record.entryTime)}
                          {isVeryLong && <span className="parked-time-warn"> · Quá dài!</span>}
                        </div>
                      </div>
                    </Col>
                  );
                })}
                {sortedParked.length > 16 && (
                  <Col xs={24}>
                    <Button type="link" onClick={() => navigate('/parking/exit')} style={{ padding: 0 }}>
                      + {sortedParked.length - 16} xe nữa — xem tất cả tại màn hình Xe Ra
                    </Button>
                  </Col>
                )}
              </Row>
            ) : (
              <Empty description="Hiện không có xe trong bãi" />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── ADMIN CHARTS ── */}
      {isAdmin && (
        <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
          <Col xs={24} lg={14}>
            <Card className="chart-card dashboard-panel" title="Lượt xe theo giờ hôm nay">
              {hourlyStats.some((h) => h.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} stroke="var(--on-surface-variant)" fontSize={11} />
                    <YAxis allowDecimals={false} stroke="var(--on-surface-variant)" fontSize={12} />
                    <ReTooltip
                      labelFormatter={(h) => `${h}:00 – ${h}:59`}
                      formatter={(value: number) => [`${value} lượt`, 'Lượt xe']}
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }}
                    />
                    <Bar dataKey="count" fill="#005daa" name="Lượt xe" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="dashboard-empty-chart">
                  <Empty description="Chưa có lượt xe nào hôm nay" />
                </div>
              )}
              {peakHour && peakHour.count > 0 && (
                <div className="dashboard-chart-caption">
                  <RiseOutlined style={{ color: '#005daa' }} /> Giờ cao điểm: <strong>{peakHour.hour}:00</strong> — {peakHour.count} lượt xe
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card className="chart-card dashboard-panel" title="Cơ cấu loại xe (30 ngày)">
              {vehicleStats.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={vehicleStats}
                        dataKey="totalRecords"
                        nameKey="vehicleType"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={48}
                        paddingAngle={2}
                      >
                        {vehicleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <ReTooltip
                        formatter={(value: number, _n, item) => [
                          `${value} lượt · ${formatCurrency(Number((item?.payload as VehicleStats)?.totalFees || 0))} đ`,
                          (item?.payload as VehicleStats)?.vehicleType || 'Loại xe',
                        ]}
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dashboard-vehicle-table">
                    {vehicleStats.map((vs, i) => (
                      <div key={vs.vehicleType} className="dashboard-vehicle-row">
                        <span className="dashboard-vehicle-dot" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="dashboard-vehicle-name">{vs.vehicleType}</span>
                        <span className="dashboard-vehicle-count">{vs.totalRecords} lượt</span>
                        <span className="dashboard-vehicle-rev">{formatCurrency(vs.totalFees)} đ</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="dashboard-empty-chart">
                  <Empty description="Chưa có dữ liệu xe hoàn tất" />
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
