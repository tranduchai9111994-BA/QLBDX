/**
 * Màn hình THANH TOÁN — tra cứu các giao dịch đã thu.
 *
 * Giao dịch được sinh TỰ ĐỘNG khi cho xe ra hoặc khi khách mua gói; màn hình này không tạo giao
 * dịch mới. Admin sửa được giao dịch ghi nhầm nhưng KHÔNG xoá được — dữ liệu thu tiền phải giữ
 * vết để đối soát.
 *
 * Vì sao KHÔNG có nút Xoá (câu hay bị hỏi): dữ liệu thu tiền là chứng từ. Xoá đi thì tổng
 * doanh thu báo cáo hôm qua và hôm nay khác nhau mà không ai giải thích được. Ghi nhầm thì
 * SỬA và bắt buộc ghi lý do vào ô Ghi chú - vẫn còn vết.
 *
 * Giao dịch đến từ HAI nguồn, phân biệt bằng cột `paymentType`:
 *   'parking' - thu khi cho xe ra   (parking.service.ts -> completeExit)
 *   'package' - thu khi bán gói     (customerPackage.service.ts)
 * Vì thế biển số phải tra theo hai đường: `parkingRecord` hoặc `customerPackage.vehicle`.
 */
import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Select, Tag, Button, message, Input, InputNumber, Space, Modal, Form } from 'antd';
import { DownloadOutlined, EditOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { Payment } from '../types';
import FilterBar from '../components/FilterBar';
import PermissionGate from '../components/PermissionGate';
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
  const [editing, setEditing] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm] = Form.useForm();

  /* ══ KHỐI 2 — DỰNG THAM SỐ LỌC ════════════════════════════════════════════════════════ */

  /**
   * Gom điều kiện lọc thành object query.
   *
   * Tách riêng thành hàm vì được dùng ở HAI chỗ với hai mục đích khác nhau:
   *   fetchPayments() -> lấy một trang để hiện bảng
   *   exportExcel()   -> lấy TOÀN BỘ kết quả để xuất file
   * Nếu viết lặp ở cả hai nơi thì sửa bộ lọc chỉ sửa một chỗ, file Excel xuất ra sẽ lệch với
   * bảng đang xem - loại lỗi rất khó phát hiện.
   */
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

  /** Tải một TRANG giao dịch. Phân trang ở backend vì bảng giao dịch tăng mãi theo thời gian. */
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

  /** Đổi mã phương thức trong DB thành chữ tiếng Việt - dùng cho file Excel xuất ra. */
  const methodLabel = (m: string) => (m === 'cash' ? 'Tiền mặt' : m === 'transfer' ? 'Chuyển khoản' : 'Thẻ');

  /* ══ KHỐI 3 — SỬA GIAO DỊCH ═══════════════════════════════════════════════════════════ */

  /** Mở modal sửa, điền sẵn giá trị hiện tại. `editing` vừa là dữ liệu vừa là cờ mở modal. */
  const openEdit = (record: Payment) => {
    setEditing(record);
    editForm.setFieldsValue({
      amount: Number(record.amount),
      paymentMethod: record.paymentMethod,
      notes: record.notes || '',
    });
  };

  const handleEditSave = async () => {
    if (!editing) return;
    try {
      // validateFields() ném lỗi nếu form chưa hợp lệ -> nhảy thẳng xuống catch, KHÔNG gọi API.
      // Gọi thủ công như vậy (thay vì dùng onFinish) vì nút Lưu nằm ở chân Modal, ngoài <Form>.
      const values = await editForm.validateFields();
      setSaving(true);
      await api.put(`/payments/${editing.id}`, values);
      message.success('Đã cập nhật giao dịch thanh toán');
      setEditing(null);
      fetchPayments(pagination.current, pagination.pageSize);
    } catch (err: any) {
      // Hai loại lỗi rơi chung vào một catch, phải phân biệt:
      //   có `errorFields` -> lỗi validate form, Ant Design đã tô đỏ ô nhập rồi -> im lặng
      //   không có         -> lỗi thật từ API -> hiện thông báo
      // Thiếu dòng này thì người dùng bỏ trống ô số tiền sẽ thấy cả hai thông báo cùng lúc.
      if (err?.errorFields) return; // lỗi validate form, không phải lỗi API
      message.error(err?.response?.data?.message || 'Không cập nhật được giao dịch');
    } finally {
      setSaving(false);
    }
  };

  /* ══ KHỐI 4 — XUẤT EXCEL ══════════════════════════════════════════════════════════════ */

  /**
   * Xuất file Excel từ tập kết quả ĐANG LỌC.
   *
   * Gọi lại API với pageSize rất lớn thay vì dùng mảng `payments` sẵn có, vì mảng đó chỉ chứa
   * 20 dòng của trang đang xem - xuất ra sẽ thiếu. Người dùng lọc "tháng 9" thì mong file có
   * đủ giao dịch tháng 9, không phải 20 dòng đầu.
   */
  const exportExcel = async () => {
    setExporting(true);
    try {
      // Xuất toàn bộ tập kết quả đang lọc, không chỉ trang hiện tại
      const res = await api.get<PaymentsResponse>('/payments', {
        params: { ...buildParams(), page: 1, pageSize: 100000 },
      });
      // Đổi dữ liệu thô sang dạng người đọc: tiêu đề cột tiếng Việt, mã phương thức thành
      // chữ, ngày giờ đã định dạng. Xuất thẳng dữ liệu API thì file toàn tên field tiếng Anh
      // và id - người nhận file không hiểu gì.
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
      // Gắn khoảng ngày vào tên file: tải nhiều lần sẽ không bị đè lên nhau, và mở thư mục
      // Downloads là biết ngay file nào của kỳ nào.
      const fileName = `lich-su-thanh-toan${filters.dateRange ? `_${filters.dateRange[0].format('DDMMYYYY')}-${filters.dateRange[1].format('DDMMYYYY')}` : ''}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch {
      message.error('Không xuất được Excel');
    } finally {
      setExporting(false);
    }
  };

  /* ══ KHỐI 5 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60, ellipsis: true },
    {
      // Biển số nằm ở HAI nơi khác nhau tuỳ nguồn giao dịch (xem phần đầu file), nên phải thử
      // lần lượt cả hai bằng `||`. Giao dịch cũ thiếu liên kết thì hiện '-' thay vì lỗi.
      title: 'Biển số', key: 'licensePlate', width: 140,
      render: (_: any, r: Payment) => (r.parkingRecord?.licensePlate || r.customerPackage?.vehicle?.licensePlate) ? <Tag className="plate-tag">{r.parkingRecord?.licensePlate || r.customerPackage?.vehicle?.licensePlate}</Tag> : '-',
    },
    {
      title: 'Số tiền (đ)', dataIndex: 'amount', key: 'amount', width: 150, align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}</span>,
    },
    {
      title: 'Phương thức', dataIndex: 'paymentMethod', key: 'paymentMethod', width: 140,
      render: (m: string) => (
        m === 'cash' ? <Tag className="chip-available">Tiền mặt</Tag> :
        m === 'transfer' ? <Tag color="purple">Chuyển khoản</Tag> :
        <Tag>Thẻ</Tag>
      ),
    },
    { title: 'Loại', dataIndex: 'paymentType', key: 'paymentType', width: 120, ellipsis: true, render: (t: string) => t === 'parking' ? 'Gửi xe' : 'Gói dịch vụ' },
    { title: 'Ngày thanh toán', dataIndex: 'paidAt', key: 'paidAt', width: 180, ellipsis: true, render: (d: string) => formatDateTime(d) },
    { title: 'Người thu', key: 'creator', width: 160, ellipsis: true, render: (_: any, r: Payment) => r.creator?.fullName || '-' },
    {
      title: 'Thao tác', key: 'action', width: 90,
      render: (_: any, r: Payment) => (
        <PermissionGate screen="payments" action="update">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Lịch sử thanh toán</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        {/* `disabled` khi không có kết quả: chặn người dùng tải về một file Excel rỗng rồi
            tưởng chức năng hỏng. */}
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

      <Modal
        title="Sửa giao dịch thanh toán"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={handleEditSave}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
      >
        {editing && (
          <>
            <p style={{ color: 'var(--on-surface-variant)', marginBottom: 16 }}>
              Giao dịch #{editing.id} — biển số{' '}
              <strong>{editing.parkingRecord?.licensePlate || editing.customerPackage?.vehicle?.licensePlate || '-'}</strong>
            </p>
            <Form form={editForm} layout="vertical">
              <Form.Item
                name="amount"
                label="Số tiền (đ)"
                rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} step={1000} />
              </Form.Item>
              <Form.Item
                name="paymentMethod"
                label="Phương thức"
                rules={[{ required: true, message: 'Vui lòng chọn phương thức' }]}
              >
                <Select>
                  <Select.Option value="cash">Tiền mặt</Select.Option>
                  <Select.Option value="card">Thẻ</Select.Option>
                  <Select.Option value="transfer">Chuyển khoản</Select.Option>
                </Select>
              </Form.Item>
              {/* Ô ghi chú là chỗ lưu LÝ DO sửa - thứ thay thế cho việc xoá giao dịch. Nhờ nó
                  mà sau này đối soát vẫn truy được vì sao số tiền bị đổi. */}
              <Form.Item name="notes" label="Ghi chú">
                <Input.TextArea rows={3} maxLength={500} placeholder="Lý do chỉnh sửa, ghi chú..." />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Payments;
