import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, DatePicker, Row, Col, Table, message, Select, Statistic,
  Radio, Button, Dropdown, Tag, Progress, Modal, Space, Alert,
} from 'antd';
import { useLanguage } from '../context/LanguageContext';
import {
  DollarOutlined, CarOutlined, RiseOutlined, BarChartOutlined,
  DownloadOutlined, FileExcelOutlined, FileTextOutlined, PrinterOutlined,
  CreditCardOutlined, ClockCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, RadialBarChart, RadialBar,
} from 'recharts';
import api from '../api/axios';
import { ExceptionStats, HourlyStats, PaymentMethodReport, RevenueReport, VehicleStats } from '../types';
import {
  exportRevenueExcel, exportRevenueCsv, exportVehicleCsv,
  exportPaymentMethodCsv, printRevenueReport, formatPeriodLabel,
  exportExceptionExcel,
} from '../utils/reportExport';
import { getChartColors, chartColor } from '../utils/chartTheme';
import { formatDateTime } from '../utils/dateFormat';

const { RangePicker } = DatePicker;

type GroupBy = 'day' | 'month' | 'year';

interface ExportPreview {
  title: string;
  formatLabel: string;
  summary: { label: string; value: string }[];
  columns: any[];
  data: any[];
  totalRows: number;
  confirmText: string;
  run: () => void;
}

function autoGroupBy(from: Dayjs, to: Dayjs): GroupBy {
  const days = to.diff(from, 'day');
  if (days > 60) return 'month';
  return 'day';
}

const fmt = (v: number) => Number(v || 0).toLocaleString('vi-VN');
const fmtM = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(v);

const Reports: React.FC = () => {
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [revenue, setRevenue] = useState<RevenueReport[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodReport | null>(null);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [exceptionStats, setExceptionStats] = useState<ExceptionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [activePreset, setActivePreset] = useState<string>('Năm nay');
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);

  const CHART_COLORS = useMemo(() => getChartColors(), []);
  const METHOD_COLORS: Record<string, string> = useMemo(() => ({
    cash: chartColor.success(),
    card: chartColor.primary(),
    transfer: chartColor.warning(),
  }), []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const p = {
        fromDate: dateRange[0].format('YYYY-MM-DD'),
        toDate: dateRange[1].format('YYYY-MM-DD'),
      };
      const [revRes, vehRes, pmRes, hrRes, excRes] = await Promise.all([
        api.get<RevenueReport[]>('/reports/revenue', { params: { ...p, groupBy } }),
        api.get<VehicleStats[]>('/reports/vehicle-stats', { params: p }),
        api.get<PaymentMethodReport>('/reports/payment-methods', { params: p }),
        api.get<HourlyStats[]>('/reports/hourly-stats', { params: { from: p.fromDate, to: p.toDate } }),
        api.get<ExceptionStats>('/reports/exception-stats', { params: p }),
      ]);
      setRevenue(revRes.data);
      setVehicleStats(vehRes.data);
      setPaymentMethods(pmRes.data);
      setHourlyStats(hrRes.data);
      setExceptionStats(excRes.data);
    } catch {
      message.error('Lỗi tải báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [dateRange, groupBy]);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates?.[0] && dates?.[1]) {
      const range: [Dayjs, Dayjs] = [dates[0], dates[1]];
      setDateRange(range);
      setGroupBy(autoGroupBy(range[0], range[1]));
    }
  };

  const totals = useMemo(() => {
    const totalRevenue = revenue.reduce((s, r) => s + Number(r.totalRevenue), 0);
    const totalParkingRev = revenue.reduce((s, r) => s + Number(r.parkingRevenue), 0);
    const totalPackageRev = revenue.reduce((s, r) => s + Number(r.packageRevenue), 0);
    const totalTransactions = revenue.reduce((s, r) => s + Number(r.totalTransactions), 0);
    const totalVehicles = vehicleStats.reduce((s, v) => s + v.totalRecords, 0);
    const avgTransaction = totalTransactions ? Math.round(totalRevenue / totalTransactions) : 0;
    return { totalRevenue, totalParkingRev, totalPackageRev, totalTransactions, totalVehicles, avgTransaction };
  }, [revenue, vehicleStats]);

  const chartData = revenue.map((r) => ({
    period: formatPeriodLabel(r.period, groupBy),
    'Gửi lẻ': Math.round(Number(r.parkingRevenue)),
    'Vé tháng': Math.round(Number(r.packageRevenue)),
    'Tổng DT': Math.round(Number(r.totalRevenue)),
    'Số GD': Number(r.totalTransactions),
  }));

  const hourlyChartData = useMemo(() => {
    const map = new Map(hourlyStats.map((h) => [h.hour, h.count]));
    return Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, count: map.get(i) || 0 }));
  }, [hourlyStats]);

  const topPeriod = useMemo(() =>
    revenue.length ? [...revenue].sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue))[0] : null,
    [revenue]
  );
  const peakHour = useMemo(() =>
    hourlyStats.length ? [...hourlyStats].sort((a, b) => b.count - a.count)[0] : null,
    [hourlyStats]
  );

  const exportPayload = {
    dateRange,
    groupBy,
    revenue,
    vehicleStats,
    paymentMethods,
    hourlyStats,
    totals,
  };

  const periodLabel = `${dateRange[0].format('DD/MM/YYYY')} – ${dateRange[1].format('DD/MM/YYYY')}`;
  const groupByLabel = groupBy === 'day' ? 'Ngày' : groupBy === 'month' ? 'Tháng' : 'Năm';

  const revenuePreviewColumns = [
    { title: groupByLabel, dataIndex: 'period', key: 'period', render: (v: string) => formatPeriodLabel(v, groupBy) },
    { title: 'Gửi lẻ (đ)', dataIndex: 'parkingRevenue', key: 'parkingRevenue', align: 'right' as const, render: (v: number) => fmt(Number(v)) },
    { title: 'Gói (đ)', dataIndex: 'packageRevenue', key: 'packageRevenue', align: 'right' as const, render: (v: number) => fmt(Number(v)) },
    { title: 'Tổng (đ)', dataIndex: 'totalRevenue', key: 'totalRevenue', align: 'right' as const, render: (v: number) => <strong>{fmt(Number(v))}</strong> },
    { title: 'Số GD', dataIndex: 'totalTransactions', key: 'totalTransactions', align: 'right' as const },
  ];
  const vehiclePreviewColumns = [
    { title: 'Loại xe', dataIndex: 'vehicleType', key: 'vehicleType' },
    { title: 'Số lượt', dataIndex: 'totalRecords', key: 'totalRecords', align: 'right' as const },
    { title: 'Doanh thu (đ)', dataIndex: 'totalFees', key: 'totalFees', align: 'right' as const, render: (v: number) => fmt(Number(v)) },
  ];
  const paymentMethodPreviewColumns = [
    { title: 'Phương thức', dataIndex: 'label', key: 'label' },
    { title: 'Số GD', dataIndex: 'totalTransactions', key: 'totalTransactions', align: 'right' as const },
    { title: 'Doanh thu (đ)', dataIndex: 'totalAmount', key: 'totalAmount', align: 'right' as const, render: (v: number) => fmt(Number(v)) },
  ];
  const exceptionPreviewColumns = [
    { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate' },
    { title: 'Loại xe', dataIndex: 'vehicleType', key: 'vehicleType' },
    { title: 'Lý do', dataIndex: 'reasonLabel', key: 'reasonLabel' },
    { title: 'Phí (đ)', dataIndex: 'fee', key: 'fee', align: 'right' as const, render: (v: number) => fmt(Number(v)) },
    { title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime', render: (v?: string) => v ? formatDateTime(v) : '-' },
  ];

  const previewExceptionExcel = () => {
    if (!exceptionStats?.totalCount) { message.warning('Không có dữ liệu ngoại lệ trong kỳ này'); return; }
    setExportPreview({
      title: 'Xem trước — Excel Checkout ngoại lệ',
      formatLabel: 'Excel (.xlsx) — 3 sheet: Tổng hợp, Chi tiết, Ca miễn phí',
      summary: [
        { label: 'Kỳ báo cáo', value: periodLabel },
        { label: 'Tổng ca ngoại lệ', value: `${exceptionStats.totalCount} ca` },
        { label: 'Ca miễn phí', value: `${exceptionStats.waivedCount} ca` },
        { label: 'Tổng phí ghi nhận', value: `${fmt(exceptionStats.totalFeeImpact)} đ` },
      ],
      columns: exceptionPreviewColumns,
      data: exceptionStats.records.slice(0, 10),
      totalRows: exceptionStats.records.length,
      confirmText: 'Tải xuống Excel',
      run: () => { exportExceptionExcel(exceptionStats, dateRange); message.success('Đã xuất Excel checkout ngoại lệ'); },
    });
  };

  const exportItems = [
    {
      key: 'excel',
      icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
      label: 'Excel — Đa sheet (Tổng hợp + Doanh thu + Loại xe + PTTT)',
      onClick: () => {
        if (!revenue.length) { message.warning('Chưa có dữ liệu'); return; }
        setExportPreview({
          title: 'Xem trước — Excel đa sheet',
          formatLabel: 'Excel (.xlsx) — 4 sheet: Tổng hợp, Doanh thu, Loại xe, PTTT',
          summary: [
            { label: 'Kỳ báo cáo', value: periodLabel },
            { label: 'Nhóm theo', value: groupByLabel },
            { label: 'Tổng doanh thu', value: `${fmt(totals.totalRevenue)} đ` },
            { label: 'Số dòng doanh thu (sheet chính)', value: `${revenue.length} dòng` },
            { label: 'Số loại xe', value: `${vehicleStats.length} dòng` },
            { label: 'Số phương thức thanh toán', value: `${paymentMethods?.byMethod.length ?? 0} dòng` },
          ],
          columns: revenuePreviewColumns,
          data: revenue.slice(0, 10),
          totalRows: revenue.length,
          confirmText: 'Tải xuống Excel',
          run: () => { exportRevenueExcel(exportPayload); message.success('Đã xuất Excel đa sheet'); },
        });
      },
    },
    { type: 'divider' as const },
    {
      key: 'csv-rev',
      icon: <FileTextOutlined />,
      label: 'CSV — Doanh thu theo kỳ',
      onClick: () => {
        if (!revenue.length) { message.warning('Chưa có dữ liệu'); return; }
        setExportPreview({
          title: 'Xem trước — CSV Doanh thu theo kỳ',
          formatLabel: 'CSV (.csv)',
          summary: [
            { label: 'Kỳ báo cáo', value: periodLabel },
            { label: 'Nhóm theo', value: groupByLabel },
            { label: 'Số dòng', value: `${revenue.length} dòng` },
          ],
          columns: revenuePreviewColumns,
          data: revenue.slice(0, 10),
          totalRows: revenue.length,
          confirmText: 'Tải xuống CSV',
          run: () => { exportRevenueCsv(exportPayload); message.success('Đã xuất CSV doanh thu'); },
        });
      },
    },
    {
      key: 'csv-veh',
      icon: <FileTextOutlined />,
      label: 'CSV — Phân loại xe',
      onClick: () => {
        if (!vehicleStats.length) { message.warning('Chưa có dữ liệu'); return; }
        setExportPreview({
          title: 'Xem trước — CSV Phân loại xe',
          formatLabel: 'CSV (.csv)',
          summary: [
            { label: 'Kỳ báo cáo', value: periodLabel },
            { label: 'Số dòng', value: `${vehicleStats.length} dòng` },
          ],
          columns: vehiclePreviewColumns,
          data: vehicleStats.slice(0, 10),
          totalRows: vehicleStats.length,
          confirmText: 'Tải xuống CSV',
          run: () => { exportVehicleCsv(exportPayload); message.success('Đã xuất CSV phân loại xe'); },
        });
      },
    },
    {
      key: 'csv-pm',
      icon: <FileTextOutlined />,
      label: 'CSV — Phương thức thanh toán',
      onClick: () => {
        if (!paymentMethods?.byMethod.length) { message.warning('Chưa có dữ liệu'); return; }
        setExportPreview({
          title: 'Xem trước — CSV Phương thức thanh toán',
          formatLabel: 'CSV (.csv)',
          summary: [
            { label: 'Kỳ báo cáo', value: periodLabel },
            { label: 'Số dòng', value: `${paymentMethods.byMethod.length} dòng` },
          ],
          columns: paymentMethodPreviewColumns,
          data: paymentMethods.byMethod.slice(0, 10),
          totalRows: paymentMethods.byMethod.length,
          confirmText: 'Tải xuống CSV',
          run: () => { exportPaymentMethodCsv(exportPayload); message.success('Đã xuất CSV phương thức thanh toán'); },
        });
      },
    },
    {
      key: 'excel-exc',
      icon: <FileExcelOutlined style={{ color: 'var(--error)' }} />,
      label: 'Excel — Checkout ngoại lệ (chi tiết + theo lý do)',
      onClick: previewExceptionExcel,
    },
    { type: 'divider' as const },
    {
      key: 'print',
      icon: <PrinterOutlined />,
      label: 'In / Xuất PDF (layout chuẩn A4)',
      onClick: () => {
        if (!revenue.length) { message.warning('Chưa có dữ liệu'); return; }
        setExportPreview({
          title: 'Xem trước — In / Xuất PDF',
          formatLabel: 'Trang in A4 (mở cửa sổ xem trước, có thể Lưu thành PDF từ hộp thoại in)',
          summary: [
            { label: 'Kỳ báo cáo', value: periodLabel },
            { label: 'Nhóm theo', value: groupByLabel },
            { label: 'Tổng doanh thu', value: `${fmt(totals.totalRevenue)} đ` },
          ],
          columns: revenuePreviewColumns,
          data: revenue.slice(0, 10),
          totalRows: revenue.length,
          confirmText: 'Mở xem trước & In',
          run: () => { printRevenueReport(exportPayload); },
        });
      },
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

  const packageRatio = totals.totalRevenue ? Math.round((totals.totalPackageRev / totals.totalRevenue) * 100) : 0;
  const parkingRatio = 100 - packageRatio;

  const revenueColumns = [
    {
      title: groupBy === 'year' ? 'Năm' : groupBy === 'month' ? 'Tháng' : 'Ngày',
      dataIndex: 'period', key: 'period',
      render: (d: string) => formatPeriodLabel(d, groupBy),
    },
    {
      title: 'Gửi lẻ (đ)', dataIndex: 'parkingRevenue', key: 'parkingRevenue', align: 'right' as const,
      render: (v: number) => <span style={{ color: 'var(--primary)' }}>{fmt(Number(v))}</span>,
    },
    {
      title: 'Vé tháng (đ)', dataIndex: 'packageRevenue', key: 'packageRevenue', align: 'right' as const,
      render: (v: number) => <span style={{ color: 'var(--success)' }}>{fmt(Number(v))}</span>,
    },
    {
      title: 'Tổng (đ)', dataIndex: 'totalRevenue', key: 'totalRevenue', align: 'right' as const,
      render: (v: number) => <strong style={{ color: 'var(--primary)' }}>{fmt(Number(v))}</strong>,
    },
    {
      title: 'Số GD', dataIndex: 'totalTransactions', key: 'totalTransactions', align: 'right' as const,
      width: 80,
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pageReports')}</h2>

      {/* ── Toolbar ── */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <RangePicker
          format="DD/MM/YYYY"
          value={dateRange}
          onChange={handleDateChange}
          placeholder={['Từ ngày', 'Đến ngày']}
        />
        <Select
          value={groupBy}
          onChange={setGroupBy}
          style={{ width: 140 }}
          options={[
            { value: 'day', label: 'Nhóm theo ngày' },
            { value: 'month', label: 'Nhóm theo tháng' },
            { value: 'year', label: 'Nhóm theo năm' },
          ]}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {quickRanges.map((q) => {
            const isActive = activePreset === q.label;
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => { setDateRange(q.range); setGroupBy(q.group); setActivePreset(q.label); }}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--outline-variant)'}`,
                  background: isActive ? 'var(--primary)' : 'var(--surface)',
                  color: isActive ? 'var(--on-primary)' : 'var(--on-surface)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {q.label}
              </button>
            );
          })}
        </div>
        <Dropdown menu={{ items: exportItems }} placement="bottomRight">
          <Button icon={<DownloadOutlined />} type="primary" ghost disabled={!revenue.length && !vehicleStats.length}>
            Xuất báo cáo
          </Button>
        </Dropdown>
      </div>

      {/* ── KPI Cards ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} xl={4}>
          <Card className="stat-card stat-info">
            <Statistic title="Tổng doanh thu" value={totals.totalRevenue}
              prefix={<DollarOutlined style={{ color: 'var(--primary)' }} />}
              valueStyle={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 700 }}
              formatter={(v) => fmt(Number(v))}
              suffix={<span style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>đ</span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card className="stat-card stat-success">
            <Statistic title="Gửi lẻ" value={totals.totalParkingRev}
              prefix={<CarOutlined style={{ color: 'var(--success)' }} />}
              valueStyle={{ color: 'var(--success)', fontSize: '1.2rem', fontWeight: 700 }}
              formatter={(v) => fmt(Number(v))}
              suffix={<span style={{ fontSize: 13 }}>đ</span>}
            />
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>{parkingRatio}% tổng DT</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card className="stat-card stat-warning">
            <Statistic title="Vé tháng/quý/năm" value={totals.totalPackageRev}
              prefix={<RiseOutlined style={{ color: 'var(--warning)' }} />}
              valueStyle={{ color: 'var(--warning)', fontSize: '1.2rem', fontWeight: 700 }}
              formatter={(v) => fmt(Number(v))}
              suffix={<span style={{ fontSize: 13 }}>đ</span>}
            />
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>{packageRatio}% tổng DT</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card className="stat-card stat-error">
            <Statistic title="Tổng lượt xe" value={totals.totalVehicles}
              prefix={<BarChartOutlined style={{ color: 'var(--error)' }} />}
              valueStyle={{ color: 'var(--error)', fontSize: '1.2rem', fontWeight: 700 }}
            />
            <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>{totals.totalTransactions.toLocaleString()} giao dịch</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card className="stat-card" style={{ borderLeft: '4px solid var(--chart-accent-1)' }}>
            <Statistic title="Trung bình / GD" value={totals.avgTransaction}
              prefix={<CreditCardOutlined style={{ color: 'var(--chart-accent-1)' }} />}
              valueStyle={{ color: 'var(--chart-accent-1)', fontSize: '1.2rem', fontWeight: 700 }}
              formatter={(v) => fmt(Number(v))}
              suffix={<span style={{ fontSize: 13 }}>đ</span>}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <Card className="stat-card" style={{ borderLeft: '4px solid var(--primary-container)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--on-surface-variant)', marginBottom: 8, fontWeight: 600 }}>
              Kỳ cao nhất
            </div>
            {topPeriod ? (
              <>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-container)' }}>
                  {formatPeriodLabel(topPeriod.period, groupBy)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--primary-container)', marginTop: 2 }}>
                  {fmt(Number(topPeriod.totalRevenue))} đ
                </div>
              </>
            ) : <div style={{ color: 'var(--on-surface-variant)' }}>—</div>}
            {peakHour && peakHour.count > 0 && (
              <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                <ClockCircleOutlined /> Cao điểm {peakHour.hour}h
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Row 1: Revenue chart + Vehicle pie ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} lg={15}>
          <Card
            className="chart-card"
            title="Doanh thu theo kỳ"
            loading={loading}
            extra={
              <Radio.Group size="small" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                <Radio.Button value="bar">Cột</Radio.Button>
                <Radio.Button value="line">Đường</Radio.Button>
                <Radio.Button value="area">Diện tích</Radio.Button>
              </Radio.Group>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} tickFormatter={fmtM} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} formatter={(v: number) => `${fmt(v)}đ`} />
                  <Legend />
                  <Bar dataKey="Gửi lẻ" stackId="rev" fill="var(--primary)" />
                  <Bar dataKey="Vé tháng" stackId="rev" fill="var(--success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} tickFormatter={fmtM} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} formatter={(v: number) => `${fmt(v)}đ`} />
                  <Legend />
                  <Line type="monotone" dataKey="Tổng DT" stroke="var(--primary)" strokeWidth={2.5} dot={chartData.length <= 24} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Gửi lẻ" stroke="var(--success)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" dataKey="Vé tháng" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </LineChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorParking" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="colorPackage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} tickFormatter={fmtM} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} formatter={(v: number) => `${fmt(v)}đ`} />
                  <Legend />
                  <Area type="monotone" dataKey="Gửi lẻ" stackId="1" stroke="var(--primary)" fill="url(#colorParking)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Vé tháng" stackId="1" stroke="var(--success)" fill="url(#colorPackage)" strokeWidth={2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card title="Phân loại xe" loading={loading} style={{ height: '100%' }}>
            {vehicleStats.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={vehicleStats}
                      dataKey="totalRecords"
                      nameKey="vehicleType"
                      cx="50%" cy="50%"
                      outerRadius={75} innerRadius={38}
                      paddingAngle={2}
                    >
                      {vehicleStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name) => [`${fmt(v)} lượt`, name]} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} />
                    <Legend verticalAlign="bottom" height={28} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {vehicleStats.map((vs, i) => (
                    <div key={vs.vehicleType} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{vs.vehicleType}</span>
                      <Tag style={{ margin: 0 }}>{vs.totalRecords} lượt</Tag>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{fmt(vs.totalFees)}đ</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>Không có dữ liệu</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Row 2: Payment methods + Hourly traffic ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} lg={12}>
          <Card title={<><CreditCardOutlined style={{ marginRight: 8 }} />Doanh thu theo phương thức thanh toán</>} loading={loading}>
            {paymentMethods && paymentMethods.byMethod.length > 0 ? (
              <Row gutter={16}>
                <Col span={12}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={paymentMethods.byMethod}
                        dataKey="totalAmount"
                        nameKey="label"
                        cx="50%" cy="50%"
                        outerRadius={80} innerRadius={42}
                        paddingAngle={3}
                      >
                        {paymentMethods.byMethod.map((m) => (
                          <Cell key={m.method} fill={METHOD_COLORS[m.method] ?? 'var(--chart-accent-1)'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${fmt(v)}đ`} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Col>
                <Col span={12}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', height: '100%', padding: '12px 0' }}>
                    {paymentMethods.byMethod.map((m) => {
                      const pct = paymentMethods.totalAmount ? Math.round((m.totalAmount / paymentMethods.totalAmount) * 100) : 0;
                      return (
                        <div key={m.method}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{m.label}</span>
                            <span style={{ color: METHOD_COLORS[m.method] ?? 'var(--chart-accent-1)', fontWeight: 700 }}>{pct}%</span>
                          </div>
                          <Progress
                            percent={pct}
                            showInfo={false}
                            strokeColor={METHOD_COLORS[m.method] ?? 'var(--chart-accent-1)'}
                            trailColor="var(--surface-container)"
                            size={['100%', 8]}
                          />
                          <div style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                            {fmt(m.totalAmount)}đ · {m.totalTransactions} GD
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Col>
              </Row>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-variant)' }}>Không có dữ liệu</div>
            )}

            {paymentMethods && paymentMethods.byType.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Phân theo loại giao dịch
                </div>
                <Row gutter={8}>
                  {paymentMethods.byType.map((t, i) => (
                    <Col span={12} key={t.type}>
                      <div style={{ background: 'var(--surface-container-low)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{t.label}</div>
                        <div style={{ fontWeight: 700, color: CHART_COLORS[i % CHART_COLORS.length], fontSize: '1rem' }}>{fmt(t.totalAmount)}đ</div>
                        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{t.totalTransactions} giao dịch</div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><ClockCircleOutlined style={{ marginRight: 8 }} />Lượt xe theo giờ trong ngày</>} loading={loading}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hourlyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--on-surface-variant)' }} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(19,27,44,0.12)' }} formatter={(v: number) => [`${v} lượt`, 'Lượt xe']} />
                <Bar dataKey="count" name="Lượt xe" radius={[3, 3, 0, 0]} maxBarSize={22}>
                  {hourlyChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.count === Math.max(...hourlyChartData.map((d) => d.count))
                        ? 'var(--error)'
                        : entry.count > 0 ? 'var(--primary)' : 'var(--surface-container)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {peakHour && peakHour.count > 0 && (
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: 'var(--on-surface-variant)' }}>
                <Tag color="red">Giờ cao điểm: {peakHour.hour}:00 — {peakHour.count} lượt</Tag>
              </div>
            )}

            {/* Tỷ lệ gói vs gửi lẻ mini chart */}
            <div style={{ marginTop: 16, padding: '12px 0 0', borderTop: '1px solid var(--outline-variant)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tỷ trọng doanh thu
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%"
                  data={[
                    { name: 'Gửi lẻ', value: parkingRatio, fill: 'var(--primary)' },
                    { name: 'Vé tháng', value: packageRatio, fill: 'var(--success)' },
                  ]}
                  startAngle={180} endAngle={0}
                >
                  <RadialBar dataKey="value" label={false} />
                  <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 8, border: 'none' }} />
                  <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Revenue detail table ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
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
                    <Table.Summary.Cell index={1} align="right"><span style={{ color: 'var(--primary)' }}>{fmt(totals.totalParkingRev)}</span></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><span style={{ color: 'var(--success)' }}>{fmt(totals.totalPackageRev)}</span></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><span style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmt(totals.totalRevenue)}</span></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">{totals.totalTransactions}</Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Exception Stats ── */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24}>
          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span>Thống kê Checkout ngoại lệ</span>
                {exceptionStats?.totalCount ? (
                  <Tag color="red">{exceptionStats.totalCount} ca</Tag>
                ) : null}
              </span>
            }
            loading={loading}
            extra={
              <Button
                size="small" icon={<FileExcelOutlined />}
                disabled={!exceptionStats?.totalCount}
                onClick={previewExceptionExcel}
              >
                Xuất Excel
              </Button>
            }
          >
            {!exceptionStats?.totalCount ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '24px 0' }}>
                Không có checkout ngoại lệ trong kỳ được chọn
              </div>
            ) : (
              <>
                {/* KPI row */}
                <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                  <Col xs={8}>
                    <div style={{ textAlign: 'center', padding: '12px 0', background: 'var(--error-container)', borderRadius: 8 }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--error)' }}>{exceptionStats.totalCount}</div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>Tổng ca ngoại lệ</div>
                    </div>
                  </Col>
                  <Col xs={8}>
                    <div style={{ textAlign: 'center', padding: '12px 0', background: 'var(--warning-container)', borderRadius: 8 }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--warning)' }}>{exceptionStats.waivedCount}</div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>Ca miễn phí</div>
                    </div>
                  </Col>
                  <Col xs={8}>
                    <div style={{ textAlign: 'center', padding: '12px 0', background: 'var(--info-container)', borderRadius: 8 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--info)' }}>
                        {fmt(exceptionStats.totalFeeImpact)}đ
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>Phí ghi nhận</div>
                    </div>
                  </Col>
                </Row>

                <Row gutter={[14, 14]}>
                  {/* Pie chart by reason */}
                  <Col xs={24} lg={10}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Phân bố theo lý do</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={exceptionStats.byReason}
                          dataKey="count"
                          nameKey="label"
                          cx="50%" cy="50%"
                          outerRadius={75}
                          label={({ label, percent }) => `${label.slice(0, 14)} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {exceptionStats.byReason.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number, name: string) => [`${v} ca`, name]} contentStyle={{ borderRadius: 8, border: 'none' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Col>

                  {/* Summary by reason table */}
                  <Col xs={24} lg={14}>
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Chi tiết theo lý do</div>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={exceptionStats.byReason}
                      rowKey="key"
                      columns={[
                        {
                          title: 'Lý do',
                          dataIndex: 'label',
                          key: 'label',
                          render: (v: string, r: { key: string }) => (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[exceptionStats.byReason.findIndex((x) => x.key === r.key) % CHART_COLORS.length], display: 'inline-block' }} />
                              {v}
                            </span>
                          ),
                        },
                        { title: 'Số ca', dataIndex: 'count', key: 'count', align: 'right' as const, render: (v: number) => <strong>{v}</strong> },
                        {
                          title: 'Phí ghi nhận', dataIndex: 'totalFeeWaived', key: 'totalFeeWaived', align: 'right' as const,
                          render: (v: number) => <span style={{ color: 'var(--info)' }}>{fmt(v)}đ</span>,
                        },
                      ]}
                    />
                  </Col>
                </Row>

                {/* Detail records */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                    Danh sách chi tiết ({exceptionStats.records.length} bản ghi)
                  </div>
                  <Table
                    size="small"
                    dataSource={exceptionStats.records}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    scroll={{ x: 700 }}
                    columns={[
                      { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
                      { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', render: (v: string) => <Tag className="plate-tag">{v}</Tag> },
                      { title: 'Loại xe', dataIndex: 'vehicleType', key: 'vehicleType', width: 100 },
                      { title: 'Lý do ngoại lệ', dataIndex: 'reasonLabel', key: 'reasonLabel', render: (v: string) => <Tag color="warning">{v}</Tag> },
                      {
                        title: 'Phí', dataIndex: 'fee', key: 'fee', align: 'right' as const,
                        render: (v: number) => v === 0 ? <Tag color="default">Miễn phí</Tag> : <span>{fmt(v)}đ</span>,
                      },
                      {
                        title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime',
                        render: (v: string) => v ? dayjs(v).format('DD/MM HH:mm') : '-',
                      },
                      { title: 'Nhân viên', dataIndex: 'staffName', key: 'staffName', width: 120 },
                    ]}
                  />
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={<span><EyeOutlined style={{ color: 'var(--primary)', marginRight: 8 }} />{exportPreview?.title}</span>}
        open={!!exportPreview}
        onCancel={() => setExportPreview(null)}
        width={720}
        footer={[
          <Button key="cancel" onClick={() => setExportPreview(null)}>Hủy</Button>,
          <Button
            key="confirm" type="primary" icon={<DownloadOutlined />}
            onClick={() => { exportPreview?.run(); setExportPreview(null); }}
          >
            {exportPreview?.confirmText}
          </Button>,
        ]}
      >
        {exportPreview && (
          <div>
            <Alert
              type="info" showIcon
              message={exportPreview.formatLabel}
              style={{ marginBottom: 14, borderRadius: 8 }}
            />
            <Space wrap size={[8, 8]} style={{ marginBottom: 14 }}>
              {exportPreview.summary.map((s) => (
                <Tag key={s.label} color="blue" style={{ padding: '4px 10px' }}>
                  {s.label}: <b>{s.value}</b>
                </Tag>
              ))}
            </Space>
            <Table
              size="small"
              columns={exportPreview.columns}
              dataSource={exportPreview.data}
              rowKey={(_, i) => String(i)}
              pagination={false}
              scroll={{ x: 'max-content' }}
              footer={() => exportPreview.totalRows > exportPreview.data.length
                ? <span style={{ color: 'var(--on-surface-variant)' }}>
                    Xem trước {exportPreview.data.length}/{exportPreview.totalRows} dòng — file tải xuống sẽ có đầy đủ {exportPreview.totalRows} dòng
                  </span>
                : null}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Reports;
