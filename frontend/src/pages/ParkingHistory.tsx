import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Input, Tag, Button, Select, Space, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
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

const ParkingHistory: React.FC = () => {
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>({ from: null, to: null, licensePlate: '', search: '' });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params: any = {};
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
    } catch (err) {
      message.error('Không tải được lịch sử xe ra vào');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [filters]);

  const columns = [
    { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', render: (t: string) => <Tag className="plate-tag">{t}</Tag> },
    { title: 'Loại xe', key: 'vehicleTypeName', render: (_: any, r: ParkingRecord) => r.vehicleType?.name || '-' },
    { title: 'Chỗ đỗ', key: 'spot', render: (_: any, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', render: (t: string) => new Date(t).toLocaleString('vi-VN') },
    { title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime', render: (t?: string) => t ? new Date(t).toLocaleString('vi-VN') : '-' },
    { title: 'Thời gian (phút)', dataIndex: 'duration', key: 'duration' },
    { title: 'Phí (đ)', dataIndex: 'fee', key: 'fee', render: (v?: number) => v ? Number(v).toLocaleString() : '0' },
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
    setFilters({ from: null, to: null, licensePlate: '', search: '' });
  };

  return (
    <div>
      <h2 className="page-title">Lịch sử xe ra vào</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
            <RangePicker onChange={handleDateChange} format="DD/MM/YYYY" placeholder={['Từ ngày', 'Đến ngày']} />
            <Input.Search
              placeholder="Tìm biển số, khách, khu..."
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
        <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
      </Card>
    </div>
  );
};

export default ParkingHistory;
