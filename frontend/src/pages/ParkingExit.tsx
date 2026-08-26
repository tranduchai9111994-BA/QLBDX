import React, { useState, useEffect } from 'react';
import {
  Table, Button, Card, message, Modal, Select, Tag, Input, Alert, Space,
  Switch, InputNumber, Form, Segmented, Tooltip,
} from 'antd';
import { WarningOutlined, GiftOutlined, UserOutlined, ClockCircleOutlined, BulbOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { CustomerPackage, ParkingRecord, ParkingZone, VehicleType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime, formatDate } from '../utils/dateFormat';
import { useAlertRuleTiers } from '../hooks/useAlertRuleTiers';

interface PackageRecommendation {
  recommendation: 'yearly' | 'quarterly' | 'monthly' | 'none';
  savings: string | null;
  frequency: number;
  totalSpent: number;
  reason: string;
  packageId?: number | null;
  packageName?: string | null;
  packagePrice?: number | null;
}

const RECOMMEND_LABEL: Record<string, string> = {
  yearly: 'gói năm',
  quarterly: 'gói quý',
  monthly: 'gói tháng',
};

interface ExitResponse {
  message: string;
  data: {
    entryTime: string;
    exitTime: string;
    durationMinutes: number;
    fee: number;
    hasPackage: boolean;
    isException?: boolean;
    exceptionReason?: string | null;
    waived?: boolean;
  };
}

interface PreviewFee {
  fee: number;
  hasPackage: boolean;
  durationMinutes: number;
  packageEndDate?: string | null;
  daysUntilExpiry?: number | null;
}

interface ReceiptData {
  licensePlate: string;
  vehicleTypeName: string;
  customerName: string;
  spotName: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
  fee: number;
  hasPackage: boolean;
  paymentMethod: 'cash' | 'card' | 'transfer';
  collectorName: string;
  isException?: boolean;
  exceptionReason?: string;
}

const EXCEPTION_REASONS = [
  { value: 'lost_ticket', label: 'Mất vé / mất phiếu' },
  { value: 'damaged_ticket', label: 'Vé hỏng / không đọc được' },
  { value: 'force_release', label: 'Giải phóng chỗ bắt buộc' },
  { value: 'fee_waiver', label: 'Miễn giảm phí (ngoại lệ)' },
  { value: 'other', label: 'Lý do khác' },
];

type PackageSegment = 'all' | 'monthly' | 'daily';

const ParkingExit: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { evaluate: evaluateAlertTier } = useAlertRuleTiers();
  const [packageSuggestion, setPackageSuggestion] = useState<PackageRecommendation | null>(null);
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exitModal, setExitModal] = useState<ParkingRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [packageSegment, setPackageSegment] = useState<PackageSegment>('all');
  const [filters, setFilters] = useState({
    search: '',
    zoneId: undefined as number | undefined,
    vehicleTypeId: undefined as number | undefined,
  });
  // vehicleId → active package
  const [activePackageMap, setActivePackageMap] = useState<Map<number, CustomerPackage>>(new Map());
  const [previewFee, setPreviewFee] = useState<PreviewFee | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [exceptionMode, setExceptionMode] = useState(false);
  const [exceptionReason, setExceptionReason] = useState<string>('lost_ticket');
  const [exceptionNote, setExceptionNote] = useState('');
  const [waiveFee, setWaiveFee] = useState(false);
  const [overrideFee, setOverrideFee] = useState<number | null>(null);

  const formatDuration = (durationMinutes: number) =>
    Math.floor(durationMinutes / 60) > 0
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}p`
      : `${durationMinutes}p`;

  const printReceipt = (receipt: ReceiptData) => {
    const paymentMethodLabel =
      receipt.paymentMethod === 'cash' ? 'Tiền mặt' : receipt.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ';
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) {
      message.error('Trình duyệt đang chặn cửa sổ in biên nhận');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Biên nhận gửi xe</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 12px; padding: 24px; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            h2 { margin: 0 0 24px; font-size: 16px; color: #4b5563; font-weight: 400; }
            .row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .label { color: #6b7280; }
            .value { font-weight: 600; text-align: right; }
            .total { font-size: 20px; color: #b91c1c; }
            .free { color: #15803d; }
            .badge { display:inline-block; padding:4px 8px; border-radius:6px; background:#fff7ed; color:#c2410c; font-size:12px; margin-bottom:12px; }
            .footer { margin-top: 24px; font-size: 13px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <h1>Biên nhận xe ra</h1>
            <h2>Hệ thống quản lý bãi đỗ xe</h2>
            ${receipt.isException ? `<div class="badge">CHECKOUT NGOẠI LỆ${receipt.exceptionReason ? `: ${receipt.exceptionReason}` : ''}</div>` : ''}
            <div class="row"><div class="label">Biển số</div><div class="value">${receipt.licensePlate}</div></div>
            <div class="row"><div class="label">Loại xe</div><div class="value">${receipt.vehicleTypeName}</div></div>
            <div class="row"><div class="label">Khách hàng</div><div class="value">${receipt.customerName}</div></div>
            <div class="row"><div class="label">Chỗ đỗ</div><div class="value">${receipt.spotName}</div></div>
            <div class="row"><div class="label">Giờ vào</div><div class="value">${formatDateTime(receipt.entryTime)}</div></div>
            <div class="row"><div class="label">Giờ ra</div><div class="value">${formatDateTime(receipt.exitTime)}</div></div>
            <div class="row"><div class="label">Thời gian đỗ</div><div class="value">${formatDuration(receipt.durationMinutes)}</div></div>
            <div class="row"><div class="label">Người thu</div><div class="value">${receipt.collectorName}</div></div>
            <div class="row"><div class="label">Phương thức thanh toán</div><div class="value">${paymentMethodLabel}</div></div>
            <div class="row"><div class="label">Phí gửi xe</div><div class="value ${receipt.hasPackage || receipt.fee === 0 ? 'free' : 'total'}">${receipt.hasPackage && receipt.fee === 0 ? 'Miễn phí (có gói)' : `${Number(receipt.fee).toLocaleString('vi-VN')} đ`}</div></div>
            <div class="footer">Biên nhận được in từ hệ thống lúc ${formatDateTime(new Date())}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { status: 'parked' };
      if (filters.search) params.search = filters.search;
      if (filters.zoneId) params.zoneId = filters.zoneId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;

      const [recordsRes, zonesRes, vehicleTypesRes, packagesRes] = await Promise.all([
        api.get<ParkingRecord[]>('/parking', { params }),
        api.get<ParkingZone[]>('/parking-zones'),
        api.get<VehicleType[]>('/vehicle-types'),
        api.get<CustomerPackage[]>('/customer-packages', { params: { status: 'active' } }),
      ]);
      setRecords(recordsRes.data);
      setZones(zonesRes.data);
      setVehicleTypes(vehicleTypesRes.data);

      const pkgMap = new Map<number, CustomerPackage>();
      packagesRes.data.forEach((pkg) => {
        if (pkg.vehicleId) pkgMap.set(pkg.vehicleId, pkg);
      });
      setActivePackageMap(pkgMap);
    } catch {
      message.error('Không tải được danh sách xe trong bãi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [filters]);

  const resetExceptionForm = () => {
    setExceptionMode(false);
    setExceptionReason('lost_ticket');
    setExceptionNote('');
    setWaiveFee(false);
    setOverrideFee(null);
  };

  const handleExit = async () => {
    if (!exitModal) return;

    if (exceptionMode) {
      if (!exceptionNote.trim() || exceptionNote.trim().length < 5) {
        message.warning('Checkout ngoại lệ cần ghi chú tối thiểu 5 ký tự');
        return;
      }
    }

    try {
      const res = exceptionMode
        ? await api.post<ExitResponse>('/parking/exit-exception', {
            parkingRecordId: exitModal.id,
            paymentMethod,
            exceptionReason,
            exceptionNote: exceptionNote.trim(),
            waiveFee: waiveFee || exceptionReason === 'fee_waiver',
            overrideFee: overrideFee,
          })
        : await api.post<ExitResponse>('/parking/exit', {
            parkingRecordId: exitModal.id,
            paymentMethod,
          });

      message.success(
        exceptionMode
          ? `Checkout ngoại lệ thành công! Phí: ${Number(res.data.data.fee).toLocaleString()}đ`
          : `Xe ra thành công! Phí: ${Number(res.data.data.fee).toLocaleString()}đ`
      );

      const reasonLabel = EXCEPTION_REASONS.find((r) => r.value === exceptionReason)?.label;
      setReceiptData({
        licensePlate: exitModal.licensePlate,
        vehicleTypeName: exitModal.vehicleType?.name || '-',
        customerName: exitModal.vehicle?.customer?.fullName || 'Khách vãng lai',
        spotName: exitModal.parkingSpot ? `${exitModal.parkingSpot.zone?.name} — ${exitModal.parkingSpot.spotNumber}` : '-',
        entryTime: res.data.data.entryTime,
        exitTime: res.data.data.exitTime,
        durationMinutes: res.data.data.durationMinutes,
        fee: Number(res.data.data.fee),
        hasPackage: res.data.data.hasPackage,
        paymentMethod,
        collectorName: user?.fullName || 'Nhân viên thu phí',
        isException: !!res.data.data.isException,
        exceptionReason: reasonLabel,
      });
      setExitModal(null);
      resetExceptionForm();
      fetchRecords();

      const customerId = exitModal.vehicle?.customer?.id;
      if (customerId) {
        try {
          const recRes = await api.get<PackageRecommendation>(`/customer-packages/recommend/${customerId}`);
          if (recRes.data.recommendation !== 'none') {
            setPackageSuggestion(recRes.data);
          }
        } catch {
          // Bỏ qua lỗi gợi ý — không ảnh hưởng luồng checkout chính
        }
      }
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const visibleRecords = records.filter((r) => {
    const hasPkg = r.vehicleId != null && activePackageMap.has(r.vehicleId);
    if (packageSegment === 'monthly') return hasPkg;
    if (packageSegment === 'daily') return !hasPkg;
    return true;
  });

  const monthlyCount = records.filter((r) => r.vehicleId != null && activePackageMap.has(r.vehicleId)).length;
  const dailyCount = records.length - monthlyCount;

  const columns = [
    {
      title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', width: 130,
      render: (t: string) => <Tag className="plate-tag">{t}</Tag>,
    },
    {
      title: 'Phân loại', key: 'packageType', width: 140,
      render: (_: unknown, r: ParkingRecord) => {
        const pkg = r.vehicleId != null ? activePackageMap.get(r.vehicleId) : undefined;
        if (pkg) {
          const daysLeft = Math.ceil(
            (new Date(pkg.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          return (
            <Tooltip title={`Gói: ${pkg.parkingPackage?.name || '—'} · HH: ${formatDate(pkg.endDate)} (còn ${daysLeft} ngày)`}>
              <Tag color="green" icon={<GiftOutlined />}>Xe tháng</Tag>
            </Tooltip>
          );
        }
        return <Tag color="default" icon={<UserOutlined />}>Vãng lai</Tag>;
      },
    },
    {
      title: 'Loại xe', key: 'vehicleTypeName', width: 110, ellipsis: true,
      render: (_: unknown, r: ParkingRecord) => r.vehicleType?.name || '-',
    },
    {
      title: 'Chỗ đỗ', key: 'spot', width: 160, ellipsis: true,
      render: (_: unknown, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-',
    },
    {
      title: 'Khách hàng', key: 'customerName', width: 170, ellipsis: true,
      render: (_: unknown, r: ParkingRecord) => r.vehicle?.customer?.fullName || 'Khách vãng lai',
    },
    {
      title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', width: 160, ellipsis: true,
      render: (t: string) => formatDateTime(t),
    },
    {
      title: 'Thời gian đỗ', key: 'duration', width: 140, ellipsis: true,
      render: (_: unknown, r: ParkingRecord) => {
        const mins = Math.ceil((Date.now() - new Date(r.entryTime).getTime()) / 60000);
        const hours = Math.floor(mins / 60);
        const label = hours > 0 ? `${hours}h ${mins % 60}p` : `${mins}p`;
        // Tô màu theo đúng ngưỡng "Xe đỗ quá lâu" đã cấu hình ở Cảnh báo → Cấu hình mức độ,
        // không dùng số cố định riêng ở đây — tránh 1 khái niệm mà 2 định nghĩa khác nhau.
        const severity = evaluateAlertTier('longParkingHours', mins / 60);
        const color = severity === 'danger' ? 'var(--error)' : severity === 'warning' ? 'var(--warning)' : severity === 'info' ? 'var(--info)' : null;
        return color
          ? <span style={{ color, fontWeight: 600 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />{label}
            </span>
          : label;
      },
    },
    {
      title: 'Thao tác', key: 'action', width: 120,
      render: (_: unknown, record: ParkingRecord) => (
        <Button type="primary" onClick={() => openExitModal(record)} size="small">Cho xe ra</Button>
      ),
    },
  ];

  const openExitModal = async (record: ParkingRecord) => {
    setExitModal(record);
    setPreviewFee(null);
    resetExceptionForm();
    setPaymentMethod('cash');
    setPreviewLoading(true);
    try {
      const res = await api.get(`/parking/${record.id}/preview`);
      setPreviewFee(res.data);
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Không tính trước được phí gửi xe — vui lòng thử lại');
    } finally {
      setPreviewLoading(false);
    }
  };

  const displayFee = (() => {
    if (!previewFee) return null;
    if (exceptionMode && (waiveFee || exceptionReason === 'fee_waiver')) return 0;
    if (exceptionMode && overrideFee !== null && overrideFee !== undefined) return overrideFee;
    return previewFee.fee;
  })();

  return (
    <div>
      <h2 className="page-title">{t('pageParkingExit')}</h2>
      <Card>
        <div className="toolbar">
          <Input.Search
            placeholder="Tìm biển số, khách, khu..."
            style={{ width: 280 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
            allowClear
          />
          <Segmented
            value={packageSegment}
            onChange={(v) => setPackageSegment(v as PackageSegment)}
            options={[
              { label: `Tất cả (${records.length})`, value: 'all' },
              { label: `Xe tháng (${monthlyCount})`, value: 'monthly' },
              { label: `Vãng lai (${dailyCount})`, value: 'daily' },
            ]}
          />
          <Space wrap style={{ marginLeft: 'auto' }}>
            <Select
              value={filters.zoneId}
              allowClear
              placeholder="Lọc theo khu"
              style={{ width: 160 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, zoneId: value }))}
              options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
            />
            <Select
              value={filters.vehicleTypeId}
              allowClear
              placeholder="Lọc loại xe"
              style={{ width: 150 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, vehicleTypeId: value }))}
              options={vehicleTypes.map((vt) => ({ value: vt.id, label: vt.name }))}
            />
            <Button onClick={() => { setSearchInput(''); setPackageSegment('all'); setFilters({ search: '', zoneId: undefined, vehicleTypeId: undefined }); }}>
              Xóa bộ lọc
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={visibleRecords}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          rowClassName={(r) => {
            const hasPkg = r.vehicleId != null && activePackageMap.has(r.vehicleId);
            return hasPkg ? 'exit-row-monthly' : '';
          }}
        />
      </Card>

      <Modal
        title={exceptionMode ? 'Checkout ngoại lệ' : 'Xác nhận xe ra'}
        open={!!exitModal}
        onOk={handleExit}
        onCancel={() => { setExitModal(null); resetExceptionForm(); }}
        okText={exceptionMode ? 'Xác nhận ngoại lệ' : 'Xác nhận'}
        cancelText="Hủy"
        okButtonProps={{ danger: exceptionMode }}
        width={560}
      >
        {exitModal && (() => {
          const activePkg = exitModal.vehicleId != null ? activePackageMap.get(exitModal.vehicleId) : undefined;
          return (
          <div>
            {/* Package / daily banner */}
            {activePkg ? (
              <Alert
                type="success"
                showIcon
                icon={<GiftOutlined />}
                style={{ marginBottom: 14, borderRadius: 8 }}
                message={
                  <span>
                    <strong>Xe tháng</strong> — {activePkg.parkingPackage?.name || 'Gói dịch vụ'}
                  </span>
                }
                description={`Hết hạn: ${formatDate(activePkg.endDate)} · Xe ra sẽ được miễn phí`}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                icon={<UserOutlined />}
                style={{ marginBottom: 14, borderRadius: 8 }}
                message={<strong>Xe vãng lai</strong>}
                description="Không có gói dịch vụ — phí sẽ được tính theo giờ/ngày"
              />
            )}

            <div className="info-panel" style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-default)', padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
              <div className="info-row"><span className="info-label">Biển số</span><Tag className="plate-tag">{exitModal.licensePlate}</Tag></div>
              <div className="info-row"><span className="info-label">Loại xe</span><span className="info-value">{exitModal.vehicleType?.name || '-'}</span></div>
              <div className="info-row"><span className="info-label">Khách hàng</span><span className="info-value">{exitModal.vehicle?.customer?.fullName || 'Khách vãng lai'}</span></div>
              <div className="info-row"><span className="info-label">Giờ vào</span><span className="info-value">{formatDateTime(exitModal.entryTime)}</span></div>
              <div className="info-row"><span className="info-label">Giờ ra</span><span className="info-value">{formatDateTime(new Date())}</span></div>
              {previewLoading ? (
                <div className="info-row"><span className="info-label">Phí gửi xe</span><span className="info-value">Đang tính...</span></div>
              ) : previewFee && (
                <>
                  <div className="info-row"><span className="info-label">Thời gian đỗ</span><span className="info-value">{formatDuration(previewFee.durationMinutes)}</span></div>
                  <div className="info-row">
                    <span className="info-label">Phí thu</span>
                    <span className="info-value" style={{ fontSize: '1.15rem', fontWeight: 700, color: previewFee.hasPackage ? 'var(--success)' : 'var(--error)' }}>
                      {previewFee.hasPackage ? '0đ — Miễn phí (xe tháng)' : `${Number(previewFee.fee).toLocaleString()}đ`}
                    </span>
                  </div>
                  {exceptionMode && (
                    <div className="info-row">
                      <span className="info-label">Phí ngoại lệ sẽ thu</span>
                      <span className="info-value" style={{ fontWeight: 700, color: 'var(--warning)' }}>
                        {Number(displayFee || 0).toLocaleString()}đ
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>
                <WarningOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />
                Checkout ngoại lệ
              </span>
              <Switch checked={exceptionMode} onChange={setExceptionMode} />
            </div>

            {exceptionMode && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Dùng khi mất vé, vé hỏng, giải phóng chỗ hoặc miễn phí đặc biệt. Hệ thống sẽ ghi chú vào lịch sử biển số."
              />
            )}

            {exceptionMode && (
              <Form layout="vertical">
                <Form.Item label="Lý do ngoại lệ" required>
                  <Select
                    value={exceptionReason}
                    onChange={(v) => {
                      setExceptionReason(v);
                      if (v === 'fee_waiver') setWaiveFee(true);
                    }}
                    options={EXCEPTION_REASONS}
                  />
                </Form.Item>
                <Form.Item label="Ghi chú xử lý" required>
                  <Input.TextArea
                    rows={3}
                    value={exceptionNote}
                    onChange={(e) => setExceptionNote(e.target.value)}
                    placeholder="VD: Khách mất vé, xác minh CCCD/biển số trước khi cho ra..."
                  />
                </Form.Item>
                <Form.Item label="Miễn phí hoàn toàn">
                  <Switch
                    checked={waiveFee || exceptionReason === 'fee_waiver'}
                    onChange={setWaiveFee}
                    disabled={exceptionReason === 'fee_waiver'}
                  />
                </Form.Item>
                {!waiveFee && exceptionReason !== 'fee_waiver' && (
                  <Form.Item label="Ghi đè phí (để trống = giữ phí hệ thống)">
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={overrideFee ?? undefined}
                      onChange={(v) => setOverrideFee(typeof v === 'number' ? v : null)}
                      placeholder="VD: 20000"
                    />
                  </Form.Item>
                )}
              </Form>
            )}

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--on-surface-variant)', marginBottom: 8 }}>Phương thức thanh toán</div>
              <Select value={paymentMethod} onChange={setPaymentMethod} style={{ width: '100%' }} disabled={!!(waiveFee || exceptionReason === 'fee_waiver') && exceptionMode}>
                <Select.Option value="cash">Tiền mặt</Select.Option>
                <Select.Option value="card">Thẻ</Select.Option>
                <Select.Option value="transfer">Chuyển khoản</Select.Option>
              </Select>
            </div>
          </div>
          );
        })()}
      </Modal>

      <Modal
        title="Biên nhận xe ra"
        open={!!receiptData}
        onCancel={() => setReceiptData(null)}
        onOk={() => receiptData && printReceipt(receiptData)}
        okText="In biên nhận"
        cancelText="Đóng"
      >
        {receiptData && (
          <div className="info-panel" style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-default)', padding: 'var(--spacing-lg)' }}>
            {receiptData.isException && <Alert type="warning" showIcon message={`Ngoại lệ: ${receiptData.exceptionReason || ''}`} style={{ marginBottom: 12 }} />}
            <div className="info-row"><span className="info-label">Biển số</span><Tag className="plate-tag">{receiptData.licensePlate}</Tag></div>
            <div className="info-row"><span className="info-label">Khách hàng</span><span className="info-value">{receiptData.customerName}</span></div>
            <div className="info-row"><span className="info-label">Chỗ đỗ</span><span className="info-value">{receiptData.spotName}</span></div>
            <div className="info-row"><span className="info-label">Thời gian đỗ</span><span className="info-value">{formatDuration(receiptData.durationMinutes)}</span></div>
            <div className="info-row"><span className="info-label">Người thu</span><span className="info-value">{receiptData.collectorName}</span></div>
            <div className="info-row"><span className="info-label">PT thanh toán</span><span className="info-value">{receiptData.paymentMethod === 'cash' ? 'Tiền mặt' : receiptData.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}</span></div>
            <div className="info-row"><span className="info-label">Phí gửi xe</span><span className="info-value" style={{ fontWeight: 700, color: receiptData.fee === 0 ? 'var(--success)' : 'var(--error)' }}>{receiptData.fee === 0 ? '0đ / miễn phí' : `${receiptData.fee.toLocaleString()}đ`}</span></div>
          </div>
        )}
      </Modal>

      <Modal
        title={<span><BulbOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />Gợi ý thông minh</span>}
        open={!!packageSuggestion}
        onCancel={() => setPackageSuggestion(null)}
        footer={[
          <Button key="dismiss" onClick={() => setPackageSuggestion(null)}>Bỏ qua</Button>,
          <Button key="view" type="primary" onClick={() => { setPackageSuggestion(null); navigate('/packages'); }}>
            Xem gói dịch vụ
          </Button>,
        ]}
      >
        {packageSuggestion && (
          <Alert
            type="info"
            showIcon
            icon={<BulbOutlined />}
            message={`Khách hàng nên đăng ký ${RECOMMEND_LABEL[packageSuggestion.recommendation] || 'gói dịch vụ'}`}
            description={
              <div>
                <div>{packageSuggestion.reason}.</div>
                {packageSuggestion.savings && <div>Ước tính tiết kiệm {packageSuggestion.savings} so với gửi lẻ.</div>}
                {packageSuggestion.packageName && (
                  <div style={{ marginTop: 8 }}>
                    Gói gợi ý: <b>{packageSuggestion.packageName}</b>
                    {packageSuggestion.packagePrice != null && ` — ${packageSuggestion.packagePrice.toLocaleString()}đ`}
                  </div>
                )}
              </div>
            }
            style={{ borderRadius: 8 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ParkingExit;
