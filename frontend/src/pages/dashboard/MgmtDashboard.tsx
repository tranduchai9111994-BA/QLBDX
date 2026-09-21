/**
 * TỔNG QUAN góc nhìn QUẢN LÝ — dành cho admin.
 *
 * Tập trung vào xu hướng và hiệu quả kinh doanh: doanh thu theo thời gian, so sánh với kỳ trước,
 * giờ cao điểm, cơ cấu loại xe, cùng các gợi ý hành động do hệ chuyên gia sinh ra
 * (/api/reports/insights).
 *
 * ===========================================================================================
 * SO VỚI OpsDashboard (bản vận hành) — khác nhau ở đâu:
 *
 *   Giống : bốn ô KPI, lấp đầy theo khu, danh sách xe đang trong bãi, cùng dùng hook
 *           useDashboardData và cùng các hàm tiện ích trong utils/dashboardUtils.
 *   Khác  : bản này THÊM doanh thu, so sánh tuần, biểu đồ xu hướng, cơ cấu loại xe và gợi ý
 *           của hệ chuyên gia; BỎ phần "Ca của tôi".
 *
 * Tham số `useDashboardData(true)` là thứ quyết định: `true` = lấy thêm các API chỉ admin mới
 * gọi được (doanh thu, thống kê, insights). OpsDashboard truyền `false`.
 *
 * PHÂN BIỆT VỚI TRANG PHÂN TÍCH (Analytics.tsx) — hay bị hỏi:
 *   Trang này    - SNAPSHOT NHANH, liếc một cái là nắm tình hình, không cần chọn kỳ.
 *   Trang Phân tích - đi sâu, chọn được kỳ tháng/quý/năm, có bảng phương án quyết định.
 *
 * Bố cục từ trên xuống:
 *   1. Bốn ô KPI                       - xe đang đỗ, chỗ trống, lượt hôm nay, doanh thu
 *   2. Ba thẻ nhận định + hai biểu đồ xu hướng 7 ngày  (phần "thông minh")
 *   3. Lấp đầy theo khu + Cảnh báo ưu tiên
 *   4. Xe đang trong bãi
 *   5. Hai biểu đồ: lượt xe theo giờ hôm nay + cơ cấu loại xe 30 ngày
 * ===========================================================================================
 */
import React, { useMemo } from 'react';
import {
  Row, Col, Card, Statistic, Spin, Empty, Alert, List, Tag, Progress,
  Button, Space, Typography, Tooltip,
} from 'antd';
import {
  CarOutlined, DollarOutlined, EnvironmentOutlined, AlertOutlined,
  ArrowRightOutlined, ClockCircleOutlined, ThunderboltOutlined,
  CheckCircleOutlined, ReloadOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, BulbOutlined, FieldTimeOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useDashboardData } from '../../hooks/useDashboardData';
import { formatCurrency, hoursParked, hoursParkedRaw, LONG_PARKING_HOURS } from '../../utils/dashboardUtils';
import { getChartColors, chartColor } from '../../utils/chartTheme';

/** Dashboard quản trị — snapshot nhanh; phân tích sâu chuyển sang trang Phân tích & Gợi ý (Q5). */
const MgmtDashboard: React.FC = () => {
  /* ══ KHỐI 1 — LẤY DỮ LIỆU ═════════════════════════════════════════════════════════════
     `true` = lấy đủ bộ dữ liệu quản trị (xem phần đầu file).                                 */
  const navigate = useNavigate();
  const {
    data, vehicleStats, hourlyStats, parkedRecords, zones, alerts, insights,
    loading, refreshing, lastUpdated, fetchData,
  } = useDashboardData(true);

  /* ══ KHỐI 2 — SỐ LIỆU DẪN XUẤT ════════════════════════════════════════════════════════ */

  // Bảng màu biểu đồ đọc từ biến CSS của giao diện (utils/chartTheme.ts) nên biểu đồ tự đổi
  // màu theo chế độ sáng/tối. useMemo để không đọc lại CSS mỗi lần vẽ.
  const COLORS = useMemo(() => getChartColors(), []);

  /**
   * Bù đủ 24 giờ cho biểu đồ cột.
   *
   * Backend chỉ trả về những giờ CÓ xe (VD 7h, 8h, 17h). Vẽ thẳng dữ liệu đó thì trục hoành
   * nhảy cóc 7 -> 8 -> 17, nhìn tưởng giờ nào cũng đông. Ở đây dựng đủ mảng 0..23 rồi tra
   * ngược lại, giờ nào không có thì count = 0 — biểu đồ mới phản ánh đúng khoảng vắng khách.
   *
   * Dùng Map thay vì .find() trong vòng lặp: Map tra thẳng theo khoá, còn find phải quét lại
   * mảng cho từng giờ.
   */
  const hourlyChartData = useMemo(() => {
    const map = new Map(hourlyStats.map((h) => [h.hour, h.count]));
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: map.get(hour) || 0 }));
  }, [hourlyStats]);

  /**
   * Tìm giờ đông nhất bằng reduce: giữ lại phần tử có count lớn hơn sau mỗi bước.
   * Phải kiểm tra mảng rỗng trước, vì reduce không có giá trị khởi tạo hợp lệ khi chưa có dữ
   * liệu (hourlyStats[0] sẽ là undefined).
   */
  const peakHour = useMemo(() => {
    if (!hourlyStats.length) return null;
    return hourlyStats.reduce((best, cur) => (cur.count > best.count ? cur : best), hourlyStats[0]);
  }, [hourlyStats]);

  // Giống hệt OpsDashboard — xem giải thích hai điều kiện "sắp đầy" ở file đó.
  const nearFullZones = zones.filter((z) => z.total > 0 && (z.available <= 2 || z.available / z.total <= 0.1));

  // Đếm riêng cảnh báo mức NGUY HIỂM để tô đỏ nút "Cảnh báo" ở đầu trang. Mức độ do BỘ LUẬT
  // của hệ chuyên gia quyết định, không viết cứng trong code này.
  const dangerAlerts = alerts.filter((a) => a.severity === 'danger').length;

  const sortedParked = useMemo(() =>
    [...parkedRecords].sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()),
    [parkedRecords]);

  const longParkedCount = sortedParked.filter((r) => hoursParkedRaw(r.entryTime) >= LONG_PARKING_HOURS).length;

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div className="dashboard-page">
      <PageHeader
        subtitle="Snapshot nhanh · xem Phân tích & Gợi ý để đi sâu"
        actions={
          <>
            {/* Nút chuyển sang đỏ khi có cảnh báo mức nguy hiểm — dùng MÀU để phân biệt "có
                việc gấp" với "có việc", thay vì bắt người xem đọc con số rồi tự đánh giá. */}
            <Button
              icon={<AlertOutlined />}
              onClick={() => navigate('/alerts')}
              danger={dangerAlerts > 0}
            >
              Cảnh báo {alerts.length > 0 && `(${alerts.length})`}
            </Button>
            <Tooltip title={`Tự động làm mới mỗi 90 giây · Cập nhật lúc ${lastUpdatedLabel}`}>
              <Button size="small" icon={<ReloadOutlined spin={refreshing} />} onClick={() => fetchData(true)} loading={refreshing}>
                {lastUpdatedLabel}
              </Button>
            </Tooltip>
          </>
        }
      />

      {/* ── KPI CARDS (trung tính — B-04) ── */}
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card stat-primary dashboard-kpi">
            <Statistic title="Xe đang đỗ" value={data?.currentlyParked || 0} prefix={<CarOutlined />} />
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
            <Statistic title="Lượt xe hôm nay" value={data?.todayEntries || 0} prefix={<ThunderboltOutlined />} />
            <div className="dashboard-kpi-foot">
              {peakHour && peakHour.count > 0
                ? <><RiseOutlined /> Cao điểm {peakHour.hour}h ({peakHour.count} lượt)</>
                : 'Chưa có dữ liệu giờ cao điểm'}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card dashboard-kpi">
            <Statistic
              title="Doanh thu hôm nay"
              value={data?.todayRevenue || 0}
              formatter={(val) => <>{formatCurrency(Number(val))} <span className="dashboard-kpi-suffix">đ</span></>}
              prefix={<DollarOutlined />}
            />
            <div className="dashboard-kpi-foot">Tháng: {formatCurrency(data?.monthRevenue || 0)} đ</div>
          </Card>
        </Col>
      </Row>

      {/* ══ PHẦN "THÔNG MINH" — điểm nhấn của đồ án ═══════════════════════════════════════
          Ba thẻ + hai biểu đồ dưới đây lấy từ MỘT API duy nhất /api/reports/insights. Backend
          đo dữ liệu thật rồi đưa qua hệ chuyên gia (nhóm luật 'report') để sinh phần
          `suggestions`. Ngưỡng nằm trong bảng ExpertRules chứ không viết cứng trong mã nguồn,
          nên admin sửa ngưỡng trên giao diện là hệ thống áp dụng ngay.

          Bọc trong `{insights && (...)}`: API này chỉ admin gọi được, thiếu dữ liệu thì ẩn cả
          khối thay vì để màn hình lỗi.                                                        */}
      {insights && (
        <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
          <Col xs={24} lg={8}>
            <Card className="dashboard-panel" title="So sánh tuần này vs tuần trước">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* So sánh theo PHẦN TRĂM thay vì số tuyệt đối: "tăng 12%" nói lên xu hướng
                    ngay, còn "tăng 3.400.000đ" thì phải biết nền cũ bao nhiêu mới đánh giá được.
                    Mũi tên lên/xuống và màu xanh/đỏ đổi theo dấu của con số. */}
                <Statistic
                  title="Doanh thu"
                  value={insights.weekComparison.changePercent.revenue}
                  precision={1}
                  suffix="%"
                  prefix={insights.weekComparison.changePercent.revenue >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: insights.weekComparison.changePercent.revenue >= 0 ? 'var(--success)' : 'var(--error)', fontSize: '1.1rem' }}
                />
                <Statistic
                  title="Lượt xe"
                  value={insights.weekComparison.changePercent.vehicles}
                  precision={1}
                  suffix="%"
                  prefix={insights.weekComparison.changePercent.vehicles >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: insights.weekComparison.changePercent.vehicles >= 0 ? 'var(--success)' : 'var(--error)', fontSize: '1.1rem' }}
                />
                <Statistic
                  title="TB thời gian đỗ"
                  value={insights.weekComparison.changePercent.avgDuration}
                  precision={1}
                  suffix="%"
                  prefix={insights.weekComparison.changePercent.avgDuration >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: insights.weekComparison.changePercent.avgDuration >= 0 ? 'var(--success)' : 'var(--error)', fontSize: '1.1rem' }}
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
              {/* Chỉ ba loại xe phổ biến nhất — đủ để nắm cơ cấu, chi tiết đã có biểu đồ tròn
                  ở cuối trang. */}
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
                  {/* Mỗi gợi ý do MỘT LUẬT của hệ chuyên gia sinh ra. Màu suy từ `s.type`:
                      dấu hiệu xấu (giảm / cảnh báo / đỗ quá lâu) tô vàng, còn lại tô xanh
                      thông tin. Danh sách rỗng KHÔNG phải lỗi — nghĩa là không luật nào cháy,
                      tức vận hành đang bình thường. */}
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

          {/* Hai biểu đồ RIÊNG cho lượt xe và doanh thu, thay vì gộp một biểu đồ hai trục tung.
              Lý do: hai đại lượng khác đơn vị (lượt / đồng) và chênh nhau hàng nghìn lần; vẽ
              chung thì đường có giá trị nhỏ bị ép sát đáy, và người xem rất dễ đọc nhầm điểm
              cắt nhau của hai đường thành một mối liên hệ không hề có. */}
          <Col xs={24} lg={12}>
            <Card className="dashboard-panel" title="Xu hướng lượt xe — 7 ngày gần nhất">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={insights.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} />
                  <YAxis allowDecimals={false} />
                  <ReTooltip
                    labelFormatter={(d) => new Date(d).toLocaleDateString('vi-VN')}
                    formatter={(value: number) => [value, 'Lượt xe']}
                  />
                  <Line type="monotone" dataKey="vehicles" name="Lượt xe" stroke={chartColor.primary()} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card className="dashboard-panel" title="Xu hướng doanh thu — 7 ngày gần nhất">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={insights.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} />
                  {/* Rút gọn nhãn trục tiền: 2500000 -> "2500k". Để nguyên số đầy đủ thì nhãn
                      dài tới mức đè lên nhau và chiếm hết bề ngang biểu đồ. */}
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <ReTooltip
                    labelFormatter={(d) => new Date(d).toLocaleDateString('vi-VN')}
                    formatter={(value: number) => [`${formatCurrency(value)}đ`, 'Doanh thu']}
                  />
                  <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke={chartColor.success()} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── ZONE OCCUPANCY + ALERTS ── */}
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
            title="Cảnh báo ưu tiên"
            extra={<Button type="link" size="small" onClick={() => navigate('/alerts')}>Xem tất cả <ArrowRightOutlined /></Button>}
          >
            {alerts.length > 0 ? (
              <List
                // Sáu cảnh báo ưu tiên nhất. Backend đã sắp theo mức độ nên cắt 6 phần tử đầu
                // là lấy đúng những cái nặng nhất, không phải cắt ngẫu nhiên.
                dataSource={alerts.slice(0, 6)}
                renderItem={(item) => (
                  <List.Item
                    className="dashboard-alert-item"
                    actions={[
                      <Button key="go" size="small" type="link" onClick={() => item.relatedPath && navigate(item.relatedPath)}>Xem</Button>,
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

      {/* ── CHARTS ── */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} lg={14}>
          <Card className="chart-card dashboard-panel" title="Lượt xe theo giờ hôm nay">
            {/* Kiểm tra CÓ ÍT NHẤT MỘT giờ khác 0 trước khi vẽ. Không kiểm thì đầu ngày sẽ
                hiện một biểu đồ 24 cột bằng 0 — trông như hỏng chứ không như "chưa có xe". */}
            {hourlyStats.some((h) => h.count > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} stroke="var(--on-surface-variant)" fontSize={11} />
                  <YAxis allowDecimals={false} stroke="var(--on-surface-variant)" fontSize={12} />
                  <ReTooltip
                    labelFormatter={(h) => `${h}:00 – ${h}:59`}
                    formatter={(value: number) => [`${value} lượt`, 'Lượt xe']}
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--elev-3)' }}
                  />
                  <Bar dataKey="count" fill={chartColor.primary()} name="Lượt xe" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="dashboard-empty-chart"><Empty description="Chưa có lượt xe nào hôm nay" /></div>
            )}
            {peakHour && peakHour.count > 0 && (
              <div className="dashboard-chart-caption">
                <RiseOutlined style={{ color: 'var(--primary)' }} /> Giờ cao điểm: <strong>{peakHour.hour}:00</strong> — {peakHour.count} lượt xe
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
                    {/* `innerRadius` khác 0 -> biểu đồ vành khuyên (donut) thay vì tròn đặc.
                        Mắt người so sánh ĐỘ DÀI CUNG chính xác hơn so sánh diện tích, nên donut
                        dễ đọc hơn hình tròn đặc. */}
                    <Pie data={vehicleStats} dataKey="totalRecords" nameKey="vehicleType" cx="50%" cy="50%" outerRadius={90} innerRadius={48} paddingAngle={2}>
                      {/* `i % COLORS.length` cho màu quay vòng: bảng màu hết màu thì dùng lại từ
                          đầu, không bị lỗi thiếu màu khi có nhiều loại xe hơn số màu. */}
                      {vehicleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <ReTooltip
                      formatter={(value: number, _n, item) => [
                        `${value} lượt · ${formatCurrency(Number((item?.payload as any)?.totalFees || 0))} đ`,
                        (item?.payload as any)?.vehicleType || 'Loại xe',
                      ]}
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--elev-3)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Bảng số liệu đặt ngay dưới biểu đồ tròn: biểu đồ cho thấy TỶ LỆ, bảng cho
                    CON SỐ CHÍNH XÁC. Chỉ có biểu đồ thì không đọc được doanh thu từng loại. */}
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
              <div className="dashboard-empty-chart"><Empty description="Chưa có dữ liệu xe hoàn tất" /></div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MgmtDashboard;
