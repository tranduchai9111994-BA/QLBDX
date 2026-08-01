import React, { useMemo, useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, message, Row, Col, Tag, Table, Alert } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { VehicleType, ParkingSpot, Vehicle, ParkingEntryForm, ParkingRecord, PackageCheckResult } from '../types';

const normalizeText = (value?: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getVehicleCategory = (vehicleTypeName?: string) => {
  const normalized = normalizeText(vehicleTypeName);
  if (normalized.includes('xe may') || normalized.includes('xe dap') || normalized.includes('motor') || normalized.includes('bicycle')) {
    return 'two-wheel';
  }
  if (normalized.includes('o to lon') || normalized.includes('xe tai') || normalized.includes('bus')) {
    return 'large-car';
  }
  if (normalized.includes('o to') || normalized.includes('car')) {
    return 'car';
  }
  return 'any';
};

const getSpotCategory = (spot: ParkingSpot) => {
  const normalized = normalizeText(`${spot.zone?.name || ''} ${spot.spotNumber} ${spot.spotType}`);
  if (normalized.includes('vip') || normalized.startsWith('d')) return 'any';
  if (normalized.includes('xe may') || normalized.startsWith('a')) return 'two-wheel';
  if (normalized.includes('o to lon') || normalized.startsWith('c')) return 'large-car';
  if (normalized.includes('o to') || normalized.startsWith('b')) return 'car';
  return 'any';
};

const isSpotCompatible = (spot: ParkingSpot, vehicleTypeName?: string) => {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);
  return spotCategory === 'any' || vehicleCategory === 'any' || spotCategory === vehicleCategory;
};

const ParkingEntry: React.FC = () => {
  const [form] = Form.useForm<ParkingEntryForm>();
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [vehicleInfo, setVehicleInfo] = useState<Vehicle | null>(null);
  const [packageCheck, setPackageCheck] = useState<PackageCheckResult | null>(null);
  const [parkedRecords, setParkedRecords] = useState<ParkingRecord[]>([]);
  const selectedVehicleTypeId = Form.useWatch('vehicleTypeId', form);

  const fetchData = async () => {
    try {
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

  const availableSpots = useMemo(
    () => spots.filter((spot) => spot.status === 'available'),
    [spots]
  );

  const compatibleAvailableSpots = useMemo(
    () => availableSpots.filter((spot) => isSpotCompatible(spot, selectedVehicleTypeName)),
    [availableSpots, selectedVehicleTypeName]
  );

  const compatibleTotalSpots = useMemo(
    () => spots.filter((spot) => isSpotCompatible(spot, selectedVehicleTypeName)).length,
    [spots, selectedVehicleTypeName]
  );

  useEffect(() => {
    const currentSpotId = form.getFieldValue('parkingSpotId');
    if (currentSpotId && !compatibleAvailableSpots.some((spot) => spot.id === currentSpotId)) {
      form.setFieldValue('parkingSpotId', undefined);
    }
  }, [compatibleAvailableSpots, form]);

  const normalizePlate = (val: string) => val.replace(/[-\s.]/g, '').toUpperCase();

  const lookupPlate = async () => {
    const raw = form.getFieldValue('licensePlate');
    if (!raw) return;
    const plate = normalizePlate(raw);
    form.setFieldsValue({ licensePlate: plate });
    try {
      const res = await api.get<Vehicle>(`/vehicles/by-plate/${encodeURIComponent(plate)}`);
      setVehicleInfo(res.data);
      form.setFieldsValue({ vehicleTypeId: res.data.vehicleTypeId });
      message.info(`Xe của: ${res.data.customer?.fullName || 'Không rõ'}`);
      // Check package expiry for this vehicle
      try {
        const pkgRes = await api.get<PackageCheckResult>(`/customer-packages/check/${res.data.id}`);
        setPackageCheck(pkgRes.data);
      } catch {
        setPackageCheck(null);
      }
    } catch {
      setVehicleInfo(null);
      setPackageCheck(null);
    }
  };

  const onFinish = async (values: ParkingEntryForm) => {
    setLoading(true);
    try {
      await api.post('/parking/entry', { ...values, licensePlate: normalizePlate(values.licensePlate) });
      message.success('Ghi nhận xe vào thành công!');
      form.resetFields();
      setVehicleInfo(null);
      setPackageCheck(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const zoneGroups = Array.from(new Set(compatibleAvailableSpots.map(s => s.zone?.name))).filter(Boolean);
  const currentAvailableCount = compatibleAvailableSpots.length;
  const currentTotalCount = compatibleTotalSpots || spots.length;
  const isFull = currentTotalCount > 0 && currentAvailableCount === 0;

  const parkedColumns = [
    { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', render: (t: string) => <Tag className="plate-tag">{t}</Tag> },
    { title: 'Loại xe', key: 'vehicleType', render: (_: any, r: ParkingRecord) => r.vehicleType?.name || '-' },
    { title: 'Chỗ đỗ', key: 'spot', render: (_: any, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Khách hàng', key: 'customer', render: (_: any, r: ParkingRecord) => r.vehicle?.customer?.fullName || 'Khách vãng lai' },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', render: (t: string) => new Date(t).toLocaleString('vi-VN') },
    {
      title: 'Thời gian đỗ', key: 'duration', render: (_: any, r: ParkingRecord) => {
        const mins = Math.ceil((Date.now() - new Date(r.entryTime).getTime()) / 60000);
        const hours = Math.floor(mins / 60);
        return hours > 0 ? `${hours}h ${mins % 60}p` : `${mins}p`;
      }
    },
  ];

  return (
    <div>
      <h2 className="page-title">Ghi nhận xe vào</h2>

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
          description={`Gói "${packageCheck.package?.parkingPackage?.name || 'vé tháng'}" hết hạn vào ${new Date(packageCheck.package!.endDate).toLocaleDateString('vi-VN')}. Vui lòng nhắc khách hàng gia hạn để tránh bị tính phí.`}
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
      )}

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card>
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item label="Biển số xe" name="licensePlate" rules={[{ required: true, message: 'Vui lòng nhập biển số xe' }, { pattern: /^\d{2}[A-Z]\d{4,5}$/, message: 'Biển số không đúng định dạng (VD: 29A87642)' }]}>
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
                  {isFull ? 'Bãi đầy — Không thể nhận xe' : 'Ghi nhận xe vào'}
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
