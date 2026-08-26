import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Select, Tag, Button, message, Input, InputNumber, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { Payment } from '../types';
import FilterBar from '../components/FilterBar';
import { formatDateTime } from '../utils/dateFormat';

const { RangePicker } = DatePicker;

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  paymentMethod: string | undefined;
  paymentType: string | undefined;
  search: string;
  minAmount?: number;
  maxAmount?: number;
}

interface PaymentsResponse {
  data: Payment[];
  total: number;
  page: number;
  pageSize: number;
}

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    paymentMethod: undefined,
    paymentType: undefined,
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const buildParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.dateRange) {
      params.fromDate = filters.dateRange[0].format('YYYY-MM-DD');
      params.toDate = filters.dateRange[1].format('YYYY-MM-DD');
    }
    if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
    if (filters.paymentType) params.paymentType = filters.paymentType;
    if (filters.search) params.search = filters.search;
    if (filters.minAmount !== undefined) params.minAmount = String(filters.minAmount);
    if (filters.maxAmount !== undefined) params.maxAmount = String(filters.maxAmount);
    return params;
  };

  const fetchPayments = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await api.get<PaymentsResponse>('/payments', { params: { ...buildParams(), page, pageSize } });
      setPayments(res.data.data);
      setPagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
    } catch (err) {
      message.error('Không tải được lịch sử thanh toán');
    } finally {
      setLoading(false);
    }
  };

  // Đổi bộ lọc -> quay về trang 1
  useEffect(() => { fetchPayments(1, pagination.pageSize); }, [filters]);

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

  const methodLabel = (m: string) => (m === 'cash' ? 'Tiền mặt' : m === 'transfer' ? 'Chuyển khoản' : 'Thẻ');

  const exportExcel = async () => {
    setExporting(true);
    try {
      // Xuất toàn bộ tập kết quả đang lọc, không chỉ trang hiện tại
      const res = await api.get<PaymentsResponse>('/payments', {
        params: { ...buildParams(), page: 1, pageSize: 100000 },
      });
      const data = res.data.data.map((p, i) => ({
        'STT': i + 1,
        'Biển số': p.parkingRecord?.licensePlate || p.customerPackage?.vehicle?.licensePlate || '-',
        'Số tiền (đ)': Number(p.amount),
        'Phương thức': methodLabel(p.paymentMethod),
        'Loại': p.paymentType === 'parking' ? 'Gửi xe' : 'Gói dịch vụ',
        'Ngày thanh toán': formatDateTime(p.paidAt),
        'Người thu': p.creator?.fullName || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Thanh toán');
      const fileName = `lich-su-thanh-toan${filters.dateRange ? `_${filters.dateRange[0].format('DDMMYYYY')}-${filters.dateRange[1].format('DDMMYYYY')}` : ''}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch {
      message.error('Không xuất được Excel');
    } finally {
      setExporting(false);
    }
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
    { title: 'Ngày thanh toán', dataIndex: 'paidAt', key: 'paidAt', render: (d: string) => formatDateTime(d) },
    { title: 'Người thu', key: 'creator', render: (_: any, r: Payment) => r.creator?.fullName || '-' },
  ];

  return (
    <div>
      <h2 className="page-title">Lịch sử thanh toán</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={exportExcel} loading={exporting} disabled={pagination.total === 0}>
          Xuất Excel
        </Button>
      </div>
      <FilterBar onReset={handleReset}>
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
      </FilterBar>
      <Card>
        <Table
          columns={columns}
          dataSource={payments}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '30', '50', '100'],
            showQuickJumper: true,
            showTotal: (total) => `${total.toLocaleString('vi-VN')} bản ghi`,
          }}
          onChange={(p) => fetchPayments(p.current || 1, p.pageSize || pagination.pageSize)}
        />
      </Card>
    </div>
  );
};

export default Payments;
