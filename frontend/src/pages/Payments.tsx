import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Select, Tag, Button, message, Input, InputNumber, Space } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { Payment } from '../types';

const { RangePicker } = DatePicker;

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  paymentMethod: string | undefined;
  paymentType: string | undefined;
  search: string;
  minAmount?: number;
  maxAmount?: number;
}

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    paymentMethod: undefined,
    paymentType: undefined,
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let url = '/payments';
      const params: Record<string, string> = {};
      if (filters.dateRange) {
        params.fromDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.toDate = filters.dateRange[1].format('YYYY-MM-DD');
      }
      if (filters.paymentMethod) {
        params.paymentMethod = filters.paymentMethod;
      }
      if (filters.paymentType) {
        params.paymentType = filters.paymentType;
      }
      if (filters.search) {
        params.search = filters.search;
      }
      if (filters.minAmount !== undefined) {
        params.minAmount = String(filters.minAmount);
      }
      if (filters.maxAmount !== undefined) {
        params.maxAmount = String(filters.maxAmount);
      }
      const res = await api.get<Payment[]>(url, { params });
      setPayments(res.data);
    } catch (err) {
      message.error('Không tải được lịch sử thanh toán');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [filters]);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setFilters({ ...filters, dateRange: dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null });
  };

  const handleMethodChange = (value: string | undefined) => {
    setFilters({ ...filters, paymentMethod: value });
  };

  const handleReset = () => {
    setSearchInput('');
    setFilters({
      dateRange: null,
      paymentMethod: undefined,
      paymentType: undefined,
      search: '',
      minAmount: undefined,
      maxAmount: undefined,
    });
  };

  const exportExcel = () => {
    const data = payments.map((p, i) => ({
      'STT': i + 1,
      'Biển số': p.parkingRecord?.licensePlate || p.customerPackage?.vehicle?.licensePlate || '-',
      'Số tiền (đ)': Number(p.amount),
      'Phương thức': p.paymentMethod === 'cash' ? 'Tiền mặt' : p.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ',
      'Loại': p.paymentType === 'parking' ? 'Gửi xe' : 'Gói dịch vụ',
      'Ngày thanh toán': dayjs(p.paidAt).format('DD/MM/YYYY HH:mm'),
      'Người thu': p.creator?.fullName || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Thanh toán');
    const fileName = `lich-su-thanh-toan${filters.dateRange ? `_${filters.dateRange[0].format('DDMMYYYY')}-${filters.dateRange[1].format('DDMMYYYY')}` : ''}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Biển số', key: 'licensePlate', render: (_: any, r: Payment) => (r.parkingRecord?.licensePlate || r.customerPackage?.vehicle?.licensePlate) ? <Tag className="plate-tag">{r.parkingRecord?.licensePlate || r.customerPackage?.vehicle?.licensePlate}</Tag> : '-' },
    { title: 'Số tiền (đ)', dataIndex: 'amount', key: 'amount', render: (v: number) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{Number(v).toLocaleString()}</span> },
    {
      title: 'Phương thức', dataIndex: 'paymentMethod', key: 'paymentMethod', render: (m: string) => (
        m === 'cash' ? <Tag className="chip-available">Tiền mặt</Tag> :
        m === 'transfer' ? <Tag color="purple">Chuyển khoản</Tag> :
        <Tag>Thẻ</Tag>
      ),
    },
    { title: 'Loại', dataIndex: 'paymentType', key: 'paymentType', render: (t: string) => t === 'parking' ? 'Gửi xe' : 'Gói dịch vụ' },
    { title: 'Ngày thanh toán', dataIndex: 'paidAt', key: 'paidAt', render: (d: string) => dayjs(d).format('DD/MM/YYYY HH:mm') },
    { title: 'Người thu', key: 'creator', render: (_: any, r: Payment) => r.creator?.fullName || '-' },
  ];

  return (
    <div>
      <h2 className="page-title">Lịch sử thanh toán</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm biển số hoặc người thu..."
              style={{ width: 280 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => setFilters({ ...filters, search: value.trim() })}
              allowClear
            />
            <RangePicker format="DD/MM/YYYY" onChange={handleDateChange} placeholder={['Từ ngày', 'Đến ngày']} />
            <Select style={{ width: 180 }} placeholder="Phương thức" allowClear onChange={handleMethodChange} value={filters.paymentMethod}>
              <Select.Option value="cash">Tiền mặt</Select.Option>
              <Select.Option value="card">Thẻ</Select.Option>
              <Select.Option value="transfer">Chuyển khoản</Select.Option>
            </Select>
            <Select
              style={{ width: 180 }}
              placeholder="Loại thanh toán"
              allowClear
              value={filters.paymentType}
              onChange={(value) => setFilters({ ...filters, paymentType: value })}
            >
              <Select.Option value="parking">Gửi xe</Select.Option>
              <Select.Option value="package">Gói dịch vụ</Select.Option>
            </Select>
            <InputNumber
              placeholder="Số tiền từ"
              style={{ width: 140 }}
              value={filters.minAmount}
              onChange={(value) => setFilters({ ...filters, minAmount: value ?? undefined })}
              min={0}
            />
            <InputNumber
              placeholder="Số tiền đến"
              style={{ width: 140 }}
              value={filters.maxAmount}
              onChange={(value) => setFilters({ ...filters, maxAmount: value ?? undefined })}
              min={0}
            />
            <Button icon={<ReloadOutlined />} onClick={handleReset}>Xóa bộ lọc</Button>
          </Space>
          <Button icon={<DownloadOutlined />} onClick={exportExcel} disabled={payments.length === 0}>Xuất Excel</Button>
        </div>
        <Table columns={columns} dataSource={payments} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
      </Card>
    </div>
  );
};

export default Payments;
