/**
 * Màn hình XE VÀO — nghiệp vụ chính hằng ngày của nhân viên.
 *
 * Vị trí trong luồng:
 *   Nhập biển số -> GET /api/parking/smart-lookup/:plate (tự điền loại xe, gợi ý chỗ đỗ)
 *     -> chọn chỗ -> POST /api/parking/entry
 *     -> backend kiểm tra và chốt giá -> chỗ đỗ chuyển sang trạng thái có xe
 *
 * LƯU Ý QUAN TRỌNG về đoạn mã trùng lặp ở đầu file:
 * Ba hàm `getVehicleCategory`, `getSpotCategory`, `isSpotCompatible` là bản sao của logic trong
 * backend/src/utils/businessRules.ts. Trùng lặp có chủ đích, để lọc danh sách chỗ đỗ ngay trên
 * trình duyệt cho phản hồi tức thì thay vì gọi API mỗi lần đổi loại xe.
 * Danh sách hiển thị ở đây chỉ mang tính GỢI Ý — quyết định cuối cùng luôn do backend kiểm tra
 * lại khi bấm lưu, nên dù bản sao này có lệch thì dữ liệu vẫn không sai.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, message, Row, Col, Tag, Table, Alert } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { VehicleType, ParkingSpot, Vehicle, ParkingEntryForm, ParkingRecord, PackageCheckResult, SmartLookupInsights, SmartLookupResult } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDateTime, formatDate } from '../utils/dateFormat';

/** Bỏ dấu tiếng Việt và chuyển chữ thường — để so khớp tên khu / tên loại xe không phụ thuộc cách gõ. */
const normalizeText = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Giữ đồng bộ với getVehicleCategory/getSpotCategory trong backend/src/utils/businessRules.ts —
// trùng lặp có chủ đích để filter phía client nhanh (không round-trip API), NHƯNG danh sách chỗ đỗ
// hiển thị chỉ mang tính gợi ý: quyết định cuối cùng luôn do backend enforce lại khi submit.
const getVehicleCategory = (vehicleTypeName?: string) => {
  const normalized = normalizeText(vehicleTypeName);
  if (normalized.includes('xe dap') || normalized.includes('bicycle')) return 'two-wheel';
  if (normalized.includes('xe may') || normalized.includes('motor')) return 'two-wheel';
  if (
    normalized.includes('o to lon') ||
    normalized.includes('xe tai') ||
    normalized.includes('xe khach') ||
    normalized.includes('bus') ||
    normalized.includes('coach') ||
    normalized.includes('truck')
  ) return 'large-car';
  if (
    normalized.includes('o to') ||
    normalized.includes('car') ||
    normalized.includes('ban tai') ||
    normalized.includes('pickup')
  ) return 'car';
  return 'any';
};

const getSpotCategory = (spot: ParkingSpot) => {
  const normalized = normalizeText(`${spot.zone?.name || ''} ${spot.spotNumber} ${spot.spotType}`);
  if (normalized.includes('vip')) return 'any';
  if (normalized.includes('xe may') || normalized.includes('motor') || normalized.startsWith('khu a') || normalized.startsWith('a')) return 'two-wheel';
  if (normalized.includes('o to lon') || normalized.includes('xe tai') || normalized.includes('bus') || normalized.startsWith('khu c') || normalized.startsWith('c')) return 'large-car';
  if (normalized.includes('o to con') || normalized.includes('o to') || normalized.includes('car') || normalized.startsWith('khu b') || normalized.startsWith('b')) return 'car';
  return 'any';
};

const isSpotCompatible = (spot: ParkingSpot, vehicleTypeName?: string) => {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);
  return spotCategory === 'any' || vehicleCategory === 'any' || spotCategory === vehicleCategory;
};

const ParkingEntry: React.FC = () => {
  const { t } = useLanguage();
  const [form] = Form.useForm<ParkingEntryForm>();
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [vehicleInfo, setVehicleInfo] = useState<Vehicle | null>(null);
  const [packageCheck, setPackageCheck] = useState<PackageCheckResult | null>(null);
  const [smartInsights, setSmartInsights] = useState<SmartLookupInsights | null>(null);
  const [parkedRecords, setParkedRecords] = useState<ParkingRecord[]>([]);
  const selectedVehicleTypeId = Form.useWatch('vehicleTypeId', form);

  /** Tải dữ liệu nền cho màn hình: loại xe, chỗ đỗ và danh sách xe đang trong bãi. */
  const fetchData = async () => {
    try {
      // Ba API độc lập nhau -> gọi song song để màn hình hiện nhanh hơn.
      const [vtRes, spRes, prRes] = await Promise.all([
        api.get<VehicleType[]>('/vehicle-types'),
        api.get<ParkingSpot[]>('/parking-spots'),
        api.get<ParkingRecord[]>('/parking', { params: { status: 'parked' } }),
      ]);
      setVehicleTypes(vtRes.data);
      setSpots(spRes.data);
      setParkedRecords(prRes.data);
    } catch (err) {
      message.error('Không tải được dữ liệu chỗ đỗ');
    }
  };

  useEffect(() => { fetchData(); }, []);
  const selectedVehicleTypeName = useMemo(
    () => vehicleInfo?.vehicleType?.name || vehicleTypes.find((type) => type.id === selectedVehicleTypeId)?.name,
    [selectedVehicleTypeId, vehicleInfo, vehicleTypes]
  );

  // `useMemo` để chỉ tính lại khi dữ liệu nguồn đổi. Mỗi lần gõ một ký tự vào ô biển số là
  // component vẽ lại; không có useMemo thì các phép lọc dưới đây chạy lại toàn bộ mỗi lần gõ.
  const availableSpots = useMemo(
    () => spots.filter((spot) => spot.status === 'available'),
    [spots]
  );

  // Danh sách chỗ thực sự chọn được: vừa còn trống, vừa phù hợp loại xe đang chọn.
  const compatibleAvailableSpots = useMemo(
    () => availableSpots.filter((spot) => isSpotCompatible(spot, selectedVehicleTypeName)),
    [availableSpots, selectedVehicleTypeName]
  );

  const compatibleTotalSpots = useMemo(
    () => spots.filter((spot) => isSpotCompatible(spot, selectedVehicleTypeName)).length,
    [spots, selectedVehicleTypeName]
  );

  // Người dùng chọn chỗ trước rồi mới đổi loại xe -> chỗ đã chọn có thể không còn phù hợp.
  // Tự xoá lựa chọn cũ để không gửi lên một chỗ sai và bị backend từ chối sau khi đã điền hết form.
  useEffect(() => {
    const currentSpotId = form.getFieldValue('parkingSpotId');
    if (currentSpotId && !compatibleAvailableSpots.some((spot) => spot.id === currentSpotId)) {
      form.setFieldValue('parkingSpotId', undefined);
    }
  }, [compatibleAvailableSpots, form]);

  const normalizePlate = (val: string) => val.replace(/[-\s.]/g, '').toUpperCase();

  /**
   * TRA CỨU THÔNG MINH — chạy khi nhân viên nhập xong biển số.
   *
   * Gọi /api/parking/smart-lookup và tự điền giúp: loại xe đã đăng ký, chỗ đỗ gợi ý (ưu tiên khu
   * khách hay đỗ), đồng thời hiện thông tin khách và tình trạng gói. Nhờ vậy với khách quen, nhân
   * viên chỉ cần gõ biển số rồi bấm lưu.
   */
  const lookupPlate = async () => {
    const raw = form.getFieldValue('licensePlate');
    if (!raw) return;
    const plate = normalizePlate(raw);
    form.setFieldsValue({ licensePlate: plate });
    try {
      const res = await api.get<SmartLookupResult>(`/parking/smart-lookup/${encodeURIComponent(plate)}`);
      const { vehicle, insights } = res.data;
      if (!vehicle) {
        setVehicleInfo(null);
        setPackageCheck(null);
        setSmartInsights(null);
        return;
      }
      setVehicleInfo(vehicle);
      setSmartInsights(insights);
      form.setFieldsValue({ vehicleTypeId: vehicle.vehicleTypeId });
      if (insights?.suggestedSpotId) {
        form.setFieldsValue({ parkingSpotId: insights.suggestedSpotId });
      }
      message.info(`Xe của: ${vehicle.customer?.fullName || 'Không rõ'}`);
      // Check package expiry for this vehicle
      try {
        const pkgRes = await api.get<PackageCheckResult>(`/customer-packages/check/${vehicle.id}`);
        setPackageCheck(pkgRes.data);
      } catch {
        setPackageCheck(null);
      }
    } catch {
      // Không tìm thấy xe (khách vãng lai) không phải là lỗi — chỉ dọn sạch thông tin gợi ý để
      // nhân viên nhập tay, không hiện thông báo lỗi gây hiểu nhầm.
      setVehicleInfo(null);
      setPackageCheck(null);
      setSmartInsights(null);
    }
  };

  /** Gửi form Xe vào. Chuẩn hoá lại biển số lần cuối trước khi gửi để khớp định dạng backend chờ. */
  const onFinish = async (values: ParkingEntryForm) => {
    setLoading(true);
    try {
      await api.post('/parking/entry', { ...values, licensePlate: normalizePlate(values.licensePlate) });
      message.success('Ghi nhận xe vào thành công!');
      form.resetFields();
      setVehicleInfo(null);
      setPackageCheck(null);
      setSmartInsights(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;

      // 409 (Conflict) = chỗ đỗ vừa bị nhân viên khác lấy mất trong lúc đang nhập form, hoặc xe
      // vừa được quầy khác ghi nhận. Đây không phải lỗi nhập liệu nên xử lý khác lỗi thường:
      // tải lại sơ đồ chỗ trống và xoá ô "Chỗ đỗ" để nhân viên chọn lại ngay, không phải F5.
      if (error.response?.status === 409) {
        message.warning(error.response.data?.message || 'Chỗ đỗ vừa bị người khác chọn, vui lòng chọn lại');
        form.setFieldValue('parkingSpotId', undefined);
        fetchData();
      } else {
        message.error(error.response?.data?.message || 'Có lỗi xảy ra');
      }
    } finally {
      setLoading(false);
    }
  };

  const zoneGroups = Array.from(new Set(compatibleAvailableSpots.map(s => s.zone?.name))).filter(Boolean);
  const currentAvailableCount = compatibleAvailableSpots.length;
  const currentTotalCount = compatibleTotalSpots || spots.length;
  const isFull = currentTotalCount > 0 && currentAvailableCount === 0;

  const parkedColumns = [
    { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', width: 130, render: (t: string) => <Tag className="plate-tag">{t}</Tag> },
    { title: 'Loại xe', key: 'vehicleType', width: 110, ellipsis: true, render: (_: any, r: ParkingRecord) => r.vehicleType?.name || '-' },
    { title: 'Chỗ đỗ', key: 'spot', width: 160, ellipsis: true, render: (_: any, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Khách hàng', key: 'customer', width: 170, ellipsis: true, render: (_: any, r: ParkingRecord) => r.vehicle?.customer?.fullName || 'Khách vãng lai' },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', width: 160, ellipsis: true, render: (t: string) => formatDateTime(t) },
    {
      title: 'Thời gian đỗ', key: 'duration', width: 130, ellipsis: true, render: (_: any, r: ParkingRecord) => {
        const mins = Math.ceil((Date.now() - new Date(r.entryTime).getTime()) / 60000);
        const hours = Math.floor(mins / 60);
        return hours > 0 ? `${hours}h ${mins % 60}p` : `${mins}p`;
      }
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pageParkingEntry')}</h2>

      {isFull && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message={selectedVehicleTypeName ? `Đã hết chỗ phù hợp cho ${selectedVehicleTypeName}` : 'Bãi đỗ xe đã đầy'}
          description={
            selectedVehicleTypeName
              ? `Hiện không còn ô đậu phù hợp cho ${selectedVehicleTypeName}. Vui lòng chờ có xe ra hoặc chọn lại loại xe đúng với biển số đã đăng ký.`
              : 'Hiện không còn ô đậu trống để nhận thêm xe.'
          }
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      {packageCheck && packageCheck.hasPackage && packageCheck.isExpiringSoon && (
        <Alert
          type="warning"
          showIcon
          message={`Gói dịch vụ sắp hết hạn — còn ${packageCheck.daysUntilExpiry} ngày`}
          description={`Gói "${packageCheck.package?.parkingPackage?.name || 'vé tháng'}" hết hạn vào ${formatDate(packageCheck.package!.endDate)}. Vui lòng nhắc khách hàng gia hạn để tránh bị tính phí.`}
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item label="Biển số xe" name="licensePlate" rules={[{ required: true, message: 'Vui lòng nhập biển số xe' }, { pattern: /^(\d{2}[A-Z]{1,2}\d{4,6}|[A-Z]{2}\d{3,5})$/, message: 'Biển số không đúng định dạng (VD: 29A87642, 59FA2345, hoặc mã nội bộ như XD001)' }]}>
                <Input placeholder="VD: 29A87642" onBlur={lookupPlate} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
              <Form.Item label="Loại xe" name="vehicleTypeId" rules={[{ required: true, message: 'Vui lòng chọn loại xe' }]}>
                <Select placeholder="Chọn loại xe">
                  {vehicleTypes.map((vt) => (
                    <Select.Option key={vt.id} value={vt.id}>{vt.name} — {Number(vt.hourlyRate).toLocaleString()}đ/lượt</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Chỗ đỗ" name="parkingSpotId" rules={[{ required: true, message: 'Vui lòng chọn chỗ đỗ' }]}>
                <Select placeholder={selectedVehicleTypeName ? `Chọn chỗ đỗ cho ${selectedVehicleTypeName}` : 'Chọn loại xe trước rồi chọn chỗ đỗ'} showSearch
                  disabled={!selectedVehicleTypeId || compatibleAvailableSpots.length === 0}
                  filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
                  {compatibleAvailableSpots.map((s) => (
                    <Select.Option key={s.id} value={s.id}>{s.zone?.name} — {s.spotNumber}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Ghi chú" name="notes">
                <Input.TextArea rows={2} placeholder="Ghi chú thêm..." />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={isFull}
                  size="large"
                  block
                  style={{ height: 48, fontWeight: 600 }}
                  danger={isFull}
                >
                  {isFull ? 'Bãi đầy — Không thể nhận xe' : t('pageParkingEntry')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          {vehicleInfo && (
            <Card className="info-panel" style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>Thông tin xe</div>
              <div className="info-row"><span className="info-label">Chủ xe</span><span className="info-value">{vehicleInfo.customer?.fullName || '-'}</span></div>
              <div className="info-row"><span className="info-label">Loại xe</span><span className="info-value">{vehicleInfo.vehicleType?.name || '-'}</span></div>
              <div className="info-row"><span className="info-label">Biển số</span><span className="info-value" style={{ fontWeight: 600, letterSpacing: '0.02em' }}>{vehicleInfo.licensePlate}</span></div>
              <div className="info-row"><span className="info-label">Hãng</span><span className="info-value">{vehicleInfo.brand || '-'}</span></div>
              <div className="info-row"><span className="info-label">Màu</span><span className="info-value">{vehicleInfo.color || '-'}</span></div>
            </Card>
          )}

          {smartInsights && (
            <Card style={{ marginBottom: 24, background: 'var(--primary-container, #e0e8ff)', border: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '1.1rem' }}>🔍</span>
                <span style={{ fontWeight: 600 }}>
                  {smartInsights.isFrequent ? 'Khách quen' : 'Nhận diện xe'} — {smartInsights.visitCount30Days} lượt đỗ / 30 ngày
                </span>
                {smartInsights.isFrequent && <Tag color="blue">Thường xuyên</Tag>}
              </div>
              {smartInsights.hasActivePackage ? (
                <div style={{ marginBottom: 8 }}>
                  Gói: <b>{smartInsights.packageName}</b>
                  {smartInsights.packageExpiry && ` (hết hạn ${formatDate(smartInsights.packageExpiry)})`}
                </div>
              ) : smartInsights.isFrequent ? (
                <Alert
                  type="info"
                  showIcon
                  message="Khách đỗ thường xuyên nhưng chưa có gói dịch vụ — gợi ý tư vấn đăng ký gói"
                  style={{ marginBottom: 8, borderRadius: 8 }}
                />
              ) : null}
              {smartInsights.avgDurationHours != null && (
                <div style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                  Thời gian đỗ trung bình: {smartInsights.avgDurationHours}h
                  {smartInsights.preferredZone && ` · Thường đỗ: ${smartInsights.preferredZone}`}
                </div>
              )}
              {smartInsights.suggestedSpotLabel && (
                <div style={{ fontSize: '0.85rem', marginTop: 6 }}>
                  Đã tự động chọn chỗ đỗ gợi ý: <b>{smartInsights.suggestedSpotLabel}</b>
                  {smartInsights.suggestedSpotNote && (
                    <span style={{ color: 'var(--warning)' }}> — {smartInsights.suggestedSpotNote}</span>
                  )}
                </div>
              )}
            </Card>
          )}
          <Card>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>Chỗ đỗ trống</div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: isFull ? 'var(--error)' : currentAvailableCount <= Math.ceil(currentTotalCount * 0.1) ? 'var(--warning)' : 'var(--primary)',
              marginBottom: 16,
            }}>
              {currentAvailableCount}
              <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--on-surface-variant)', marginLeft: 8 }}>
                / {currentTotalCount}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {zoneGroups.map(zone => (
                <Tag key={zone} className="chip-available" style={{ borderRadius: 9999 }}>{zone}: {compatibleAvailableSpots.filter(s => s.zone?.name === zone).length}</Tag>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>
          Xe đang trong bãi ({parkedRecords.length})
        </div>
        <Table columns={parkedColumns} dataSource={parkedRecords} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
      </Card>
    </div>
  );
};

export default ParkingEntry;
