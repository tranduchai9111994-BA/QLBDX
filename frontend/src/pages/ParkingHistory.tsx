import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Input, Tag, Button, Select, Space, message, Modal, Statistic, Row, Col, Alert } from 'antd';
import { ReloadOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { ParkingRecord, ParkingZone, VehicleType } from '../types';

const { RangePicker } = DatePicker;

interface Filters {
  from: string | null;
  to: string | null;
  licensePlate: string;
  search: string;
  zoneId?: number;
  vehicleTypeId?: number;
}

interface PlateHistoryResponse {
  licensePlate: string;
  total: number;
  currentlyParked: number;
  completed: number;
  exceptionCount: number;
  records: ParkingRecord[];
}

const ParkingHistory: React.FC = () => {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [plateInput, setPlateInput] = useState('');
  const [filters, setFilters] = useState<Filters>({ from: null, to: null, licensePlate: '', search: '' });
  const [plateModalOpen, setPlateModalOpen] = useState(false);
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateHistory, setPlateHistory] = useState<PlateHistoryResponse | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.licensePlate) params.licensePlate = filters.licensePlate;
      if (filters.search) params.search = filters.search;
      if (filters.zoneId) params.zoneId = filters.zoneId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      const [historyRes, zonesRes, vehicleTypesRes] = await Promise.all([
        api.get<ParkingRecord[]>('/parking/history', { params }),
        api.get<ParkingZone[]>('/parking-zones'),
        api.get<VehicleType[]>('/vehicle-types'),
      ]);
      setRecords(historyRes.data);
      setZones(zonesRes.data);
      setVehicleTypes(vehicleTypesRes.data);
    } catch {
      message.error('Không tải được lịch sử xe ra vào');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [filters]);

  const lookupPlateHistory = async (plate?: string) => {
    const value = (plate || plateInput).trim();
    if (!value) {
      message.warning('Nhập biển số để tra cứu lịch sử');
      return;
    }
    setPlateLoading(true);
    setPlateModalOpen(true);
    try {
      const res = await api.get<PlateHistoryResponse>(`/parking/plate-history/${encodeURIComponent(value)}`);
      setPlateHistory(res.data);
      setFilters((prev) => ({ ...prev, licensePlate: value, search: '' }));
      setSearchInput('');
    } catch {
      message.error('Không tra cứu được lịch sử biển số');
      setPlateHistory(null);
    } finally {
      setPlateLoading(false);
    }
  };

  const columns = [
    {
      title: 'Biển số',
      dataIndex: 'licensePlate',
      key: 'licensePlate',
      render: (t: string) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => { setPlateInput(t); lookupPlateHistory(t); }}>
          <Tag className="plate-tag">{t}</Tag>
        </Button>
      ),
    },
    { title: 'Loại xe', key: 'vehicleTypeName', render: (_: unknown, r: ParkingRecord) => r.vehicleType?.name || '-' },
    { title: 'Chỗ đỗ', key: 'spot', render: (_: unknown, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Khách', key: 'customer', render: (_: unknown, r: ParkingRecord) => r.vehicle?.customer?.fullName || 'Khách vãng lai' },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', render: (t: string) => new Date(t).toLocaleString('vi-VN') },
    { title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime', render: (t?: string) => t ? new Date(t).toLocaleString('vi-VN') : '-' },
    { title: 'Thời gian (phút)', dataIndex: 'duration', key: 'duration' },
    { title: 'Phí (đ)', dataIndex: 'fee', key: 'fee', render: (v?: number) => v ? Number(v).toLocaleString() : '0' },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (notes?: string) => {
        if (!notes) return '-';
        if (notes.includes('[NGOAI_LE:')) return <Tag color="orange">Ngoại lệ</Tag>;
        return notes;
      },
    },
  ];

  const plateColumns = [
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => status === 'parked' ? <Tag color="blue">Đang đỗ</Tag> : <Tag color="green">Đã ra</Tag>,
    },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', render: (t: string) => new Date(t).toLocaleString('vi-VN') },
    { title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime', render: (t?: string) => t ? new Date(t).toLocaleString('vi-VN') : '-' },
    { title: 'Chỗ đỗ', key: 'spot', render: (_: unknown, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Phí (đ)', dataIndex: 'fee', key: 'fee', render: (v?: number) => v ? Number(v).toLocaleString() : '0' },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes?: string) => notes?.includes('[NGOAI_LE:') ? <Tag color="orange">Checkout ngoại lệ</Tag> : (notes || '-'),
    },
  ];

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setFilters({
      ...filters,
      from: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : null,
      to: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : null,
    });
  };

  const resetFilters = () => {
    setSearchInput('');
    setPlateInput('');
    setFilters({ from: null, to: null, licensePlate: '', search: '' });
  };

  return (
    <div>
      <h2 className="page-title">Lịch sử xe ra vào</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              <HistoryOutlined /> Tra cứu lịch sử theo biển số
            </div>
            <div style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
              Xem toàn bộ lần vào/ra, đang đỗ và checkout ngoại lệ của một biển số
            </div>
          </div>
          <Space wrap>
            <Input
              placeholder="VD: 59B112345"
              value={plateInput}
              onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
              onPressEnter={() => lookupPlateHistory()}
              style={{ width: 200 }}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => lookupPlateHistory()}>
              Tra cứu biển số
            </Button>
          </Space>
        </Space>
      </Card>

      <Card>
        <div className="toolbar">
          <Space wrap>
            <RangePicker
              value={filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : undefined}
              onChange={handleDateChange}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
            />
            <Input.Search
              placeholder="Tìm biển số, khách, khu, ghi chú..."
              style={{ width: 280 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => setFilters({ ...filters, search: value.trim(), licensePlate: '' })}
              allowClear
            />
            <Select
              value={filters.zoneId}
              allowClear
              placeholder="Lọc theo khu"
              style={{ width: 180 }}
              onChange={(value) => setFilters({ ...filters, zoneId: value })}
              options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
            />
            <Select
              value={filters.vehicleTypeId}
              allowClear
              placeholder="Lọc theo loại xe"
              style={{ width: 180 }}
              onChange={(value) => setFilters({ ...filters, vehicleTypeId: value })}
              options={vehicleTypes.map((vehicleType) => ({ value: vehicleType.id, label: vehicleType.name }))}
            />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>Xóa bộ lọc</Button>
          </Space>
        </div>
        {filters.licensePlate && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Đang lọc lịch sử biển số: ${filters.licensePlate}`}
            action={<Button size="small" onClick={() => setFilters({ ...filters, licensePlate: '' })}>Bỏ lọc biển số</Button>}
          />
        )}
        <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={`Lịch sử biển số ${plateHistory?.licensePlate || plateInput}`}
        open={plateModalOpen}
        onCancel={() => setPlateModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPlateModalOpen(false)}>Đóng</Button>,
        ]}
        width={900}
      >
        {plateHistory && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card><Statistic title="Tổng lượt" value={plateHistory.total} /></Card></Col>
              <Col span={6}><Card><Statistic title="Đang đỗ" value={plateHistory.currentlyParked} valueStyle={{ color: '#005daa' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Đã ra" value={plateHistory.completed} valueStyle={{ color: '#1a7a2e' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Ngoại lệ" value={plateHistory.exceptionCount} valueStyle={{ color: '#934600' }} /></Card></Col>
            </Row>
            <Table
              columns={plateColumns}
              dataSource={plateHistory.records}
              rowKey="id"
              loading={plateLoading}
              pagination={{ pageSize: 8 }}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default ParkingHistory;
