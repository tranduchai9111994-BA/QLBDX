/**
 * TỔNG QUAN góc nhìn VẬN HÀNH — dành cho nhân viên trực quầy.
 *
 * Tập trung vào việc đang diễn ra ngay lúc này: xe đang đỗ, chỗ còn trống theo khu, xe đỗ quá lâu,
 * gói sắp hết hạn và tiền đã thu trong ca của chính mình.
 */
import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Spin, Empty, Alert, List, Tag, Progress,
  Button, Space, Tooltip,
} from 'antd';
import {
  CarOutlined, EnvironmentOutlined, LoginOutlined, AlertOutlined,
  ArrowRightOutlined, ClockCircleOutlined, WarningOutlined, ReloadOutlined,
  DollarOutlined, WalletOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useDashboardData } from '../../hooks/useDashboardData';
import { formatCurrency, hoursParked, hoursParkedRaw, LONG_PARKING_HOURS } from '../../utils/dashboardUtils';
import { useAuth } from '../../context/AuthContext';

/** Dashboard nhân viên vận hành — không có doanh thu toàn bãi, chỉ đối soát ca của bản thân (Q1). */
const OpsDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    data, parkedRecords, expiringPackages, zones, myShift,
    loading, refreshing, lastUpdated, fetchData,
  } = useDashboardData(false);

  const sortedParked = useMemo(() =>
    [...parkedRecords].sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()),
    [parkedRecords]);

  const longParkedCount = sortedParked.filter((r) => hoursParkedRaw(r.entryTime) >= LONG_PARKING_HOURS).length;
  const nearFullZones = zones.filter((z) => z.total > 0 && (z.available <= 2 || z.available / z.total <= 0.1));

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div className="dashboard-page">
      <PageHeader
        subtitle={`Ca vận hành · ${user?.fullName || ''}`}
        actions={
          <>
            <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/parking/entry')}>Xe vào</Button>
            <Button icon={<CarOutlined />} onClick={() => navigate('/parking/exit')}>Xe ra</Button>
            <Button icon={<EnvironmentOutlined />} onClick={() => navigate('/parking-spots')}>Sơ đồ bãi</Button>
            <Tooltip title={`Tự động làm mới mỗi 90 giây · Cập nhật lúc ${lastUpdatedLabel}`}>
              <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={() => fetchData(true)} loading={refreshing}>
                {lastUpdatedLabel}
              </Button>
            </Tooltip>
          </>
        }
      />

      {/* ── KPI CARDS (trung tính, không dùng màu bán/cảnh báo cho số liệu bình thường) ── */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card stat-primary dashboard-kpi">
            <Statistic
              title="Xe đang đỗ"
              value={data?.currentlyParked || 0}
              prefix={<CarOutlined />}
            />
            <div className="dashboard-kpi-foot">
              {longParkedCount > 0
                ? <span className="kpi-warn"><WarningOutlined /> {longParkedCount} xe đỗ &gt;{LONG_PARKING_HOURS}h</span>
                : 'Đang chiếm chỗ trong bãi'}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card dashboard-kpi">
            <Statistic
              title="Chỗ trống"
              value={data?.availableSpots || 0}
              suffix={<span className="dashboard-kpi-suffix">/ {data?.totalSpots || 0}</span>}
              prefix={<EnvironmentOutlined />}
            />
            <div className="dashboard-kpi-foot">
              {nearFullZones.length > 0
                ? <span className="kpi-warn"><WarningOutlined /> {nearFullZones.length} khu sắp đầy</span>
                : 'Sẵn sàng tiếp nhận xe mới'}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card dashboard-kpi">
            <Statistic title="Gói sắp hết hạn" value={expiringPackages.length} prefix={<ClockCircleOutlined />} />
            <div className="dashboard-kpi-foot">Hết hạn trong 7 ngày tới</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card dashboard-kpi">
            <Statistic
              title="Cảnh báo vận hành"
              value={nearFullZones.length + (longParkedCount > 0 ? 1 : 0)}
              prefix={<AlertOutlined />}
            />
            <div className="dashboard-kpi-foot">
              {nearFullZones.length + longParkedCount > 0
                ? <span className="kpi-warn">Cần chú ý một số khu/xe</span>
                : 'Không có vấn đề nghiêm trọng'}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── CA CỦA TÔI ── */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24}>
          <Card
            className="dashboard-panel"
            title={<><WalletOutlined /> Ca của tôi — đối soát hôm nay</>}
            extra={<Button type="link" size="small" onClick={() => navigate('/payments')}>Chi tiết thanh toán <ArrowRightOutlined /></Button>}
          >
            {myShift ? (
              <Row gutter={[14, 14]}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Tổng thu ca này"
                    value={myShift.totalAmount}
                    formatter={(v) => <>{formatCurrency(Number(v))} <span className="dashboard-kpi-suffix">đ</span></>}
                    prefix={<DollarOutlined />}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic title="Số giao dịch" value={myShift.totalTransactions} />
                </Col>
                <Col xs={24} sm={8}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Theo phương thức
                  </div>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    {myShift.byMethod.length === 0
                      ? <span style={{ color: 'var(--on-surface-variant)' }}>Chưa có giao dịch</span>
                      : myShift.byMethod.map((m) => (
                        <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>{m.label}</span>
                          <span>{formatCurrency(m.totalAmount)} đ ({m.totalTransactions})</span>
                        </div>
                      ))}
                  </Space>
                </Col>
              </Row>
            ) : (
              <Empty description="Chưa có dữ liệu ca hôm nay" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── ZONE OCCUPANCY + EXPIRING PACKAGES ── */}
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
                  const statusColor = zone.fillRate >= 90 ? 'var(--error)' : zone.fillRate >= 70 ? 'var(--warning)' : 'var(--success)';
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
                      <Progress percent={zone.fillRate} showInfo={false} strokeColor={statusColor} trailColor="var(--surface-container)" size={['100%', 10]} />
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
            title="Gói sắp hết hạn"
            extra={<Button type="link" size="small" onClick={() => navigate('/customer-packages')}>Quản lý <ArrowRightOutlined /></Button>}
          >
            {expiringPackages.length > 0 ? (
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
                          <div className="dashboard-list-sub">{pkg.customer?.fullName} · {pkg.parkingPackage?.name}</div>
                        </div>
                        <Tag color={daysLeft <= 2 ? 'red' : 'orange'}>{daysLeft <= 0 ? 'Hôm nay' : `còn ${daysLeft} ngày`}</Tag>
                      </div>
                    </List.Item>
                  );
                }}
              />
            ) : (
              <Alert type="success" showIcon message="Không có gói hết hạn trong 7 ngày" />
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
                {longParkedCount > 0 && <Tag color="orange"><WarningOutlined /> {longParkedCount} xe đỗ &gt;{LONG_PARKING_HOURS}h</Tag>}
              </Space>
            }
            extra={<Button type="link" size="small" onClick={() => navigate('/parking/exit')}>Xe ra <ArrowRightOutlined /></Button>}
          >
            {parkedRecords.length > 0 ? (
              <Row gutter={[12, 4]}>
                {sortedParked.slice(0, 16).map((record) => {
                  const hrs = hoursParkedRaw(record.entryTime);
                  const isLong = hrs >= LONG_PARKING_HOURS;
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={record.id}>
                      <div className={`dashboard-parked-item ${isLong ? 'parked-critical' : ''}`}>
                        <div className="dashboard-parked-plate">{record.licensePlate}</div>
                        <div className="dashboard-parked-meta">
                          <span>{record.vehicleType?.name || '—'}</span>
                          {record.parkingSpot && <span> · {record.parkingSpot.zone?.name || ''} {record.parkingSpot.spotNumber}</span>}
                        </div>
                        <div className="dashboard-parked-time">
                          <ClockCircleOutlined style={{ fontSize: 11 }} />{' '}{hoursParked(record.entryTime)}
                          {isLong && <span className="parked-time-warn"> · Quá dài!</span>}
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
    </div>
  );
};

export default OpsDashboard;
