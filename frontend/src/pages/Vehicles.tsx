/**
 * Màn hình PHƯƠNG TIỆN — danh sách xe của khách, kèm trạng thái đang trong bãi hay đã ra ngoài.
 * Mỗi xe gắn với một khách hàng và một loại xe; loại xe quyết định bảng giá áp dụng.
 *
 * Khung 6 khối giống hệt Customers.tsx (đọc file đó trước nếu chưa quen) - ở đây chỉ chú thích
 * ba chỗ KHÁC BIỆT riêng của trang này:
 *   1. Phải tải kèm hai danh mục phụ (loại xe, khách hàng) để đổ vào ô Select trong modal.
 *   2. Biển số được CHUẨN HOÁ trước khi gửi (normalizePlate).
 *   3. Nhập Excel phải TỰ TRA id: file người dùng nộp ghi "SĐT chủ xe" và "tên loại xe" chứ
 *      không ai gõ id, nên phải đổi tên/SĐT -> id trước khi gọi API.
 *
 * Xe ở đây bị XOÁ THẬT (khác khách hàng chỉ ngừng hoạt động) - backend chặn không cho xoá xe
 * còn lượt gửi đang mở hoặc còn gói dịch vụ, xem backend/src/services/vehicle.service.ts.
 */
import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, Select, message, Popconfirm, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { Vehicle, VehicleType, Customer, VehicleForm } from '../types';
import { useLanguage } from '../context/LanguageContext';
import ImportModal, { ColumnDef, ReferenceSheet } from '../components/ImportModal';
import StatusTag from '../components/StatusTag';
import PermissionGate from '../components/PermissionGate';
import FilterBar from '../components/FilterBar';
import { defaultPagination } from '../utils/tablePagination';

const Vehicles: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);         // dữ liệu chính của bảng
  // Hai danh mục phụ: KHÔNG hiện ra bảng, chỉ dùng để đổ vào ô Select trong modal và để tra
  // id khi nhập Excel. Phải tải sẵn vì người dùng cần chọn ngay khi modal mở.
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form] = Form.useForm<VehicleForm>();
  const [importOpen, setImportOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    customerId: undefined as number | undefined,
    vehicleTypeId: undefined as number | undefined,
    parkingStatus: undefined as string | undefined,
  });

  /**
   * Chuẩn hoá biển số: bỏ gạch ngang, dấu cách, dấu chấm rồi chuyển hết sang CHỮ IN.
   *   "29a-123.45"  ->  "29A12345"
   *
   * Vì sao bắt buộc: cùng một chiếc xe, nhân viên A gõ "29A-12345", nhân viên B gõ "29a 12345".
   * Nếu lưu nguyên văn thì DB có hai bản ghi cho một xe, và lúc xe ra tra biển số sẽ không
   * tìm thấy lượt gửi. Chuẩn hoá đưa mọi cách gõ về MỘT dạng duy nhất.
   *
   * Backend có hàm tương ứng trong utils/businessRules.ts và cũng chuẩn hoá lại - hàm ở đây
   * chỉ để người dùng thấy ngay biển số đã gọn, không phải là chốt chặn.
   */
  const normalizePlate = (val: string) => val.replace(/[-\s.]/g, '').toUpperCase();

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /** Tải xe (có lọc) + hai danh mục phụ. */
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filters.search) params.search = filters.search;
      if (filters.customerId) params.customerId = filters.customerId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      if (filters.parkingStatus) params.parkingStatus = filters.parkingStatus;

      // Promise.all -> ba API chạy SONG SONG. Gọi tuần tự (await từng dòng) sẽ mất tổng thời
      // gian của cả ba; song song chỉ mất bằng lời gọi chậm nhất. Được phép song song vì ba
      // lời gọi độc lập, không cái nào cần kết quả của cái kia.
      const [vRes, vtRes, cRes] = await Promise.all([
        api.get<Vehicle[]>('/vehicles', { params }),
        api.get<VehicleType[]>('/vehicle-types'),
        api.get<Customer[]>('/customers'),
      ]);
      setVehicles(vRes.data);
      setVehicleTypes(vtRes.data);
      setCustomers(cRes.data);
    } catch (err) {
      message.error('Không tải được danh sách phương tiện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

  /* ══ KHỐI 3 — GHI DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /** Lưu form, dùng chung Thêm/Sửa - phân biệt bằng `editing` (xem Customers.tsx). */
  const handleSubmit = async (values: VehicleForm) => {
    try {
      // Ghi đè licensePlate bằng bản đã chuẩn hoá. Dùng `...values` trước rồi ghi đè sau để
      // các field còn lại (hãng, model, màu) vẫn giữ nguyên.
      const payload = { ...values, licensePlate: normalizePlate(values.licensePlate) };
      if (editing) {
        await api.put(`/vehicles/${editing.id}`, payload);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/vehicles', payload);
        message.success('Thêm xe thành công');
      }
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: Vehicle) => {
    setEditing(record);
    form.setFieldsValue({
      customerId: record.customerId,
      vehicleTypeId: record.vehicleTypeId,
      licensePlate: record.licensePlate,
      brand: record.brand,
      model: record.model,
      color: record.color,
    });
    setModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/vehicles/${id}`);
      message.success('Xóa xe thành công');
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({ search: '', customerId: undefined, vehicleTypeId: undefined, parkingStatus: undefined });
  };

  /* ══ KHỐI 4 — NHẬP TỪ EXCEL ═══════════════════════════════════════════════════════════ */

  // Cột file Excel. Chú ý `choices` ở cột "Loại xe": ImportModal dùng nó để tạo ô chọn thả
  // xuống trong file mẫu, nên người dùng không gõ sai tên loại xe được.
  const importColumns: ColumnDef[] = [
    { key: 'licensePlate',  label: 'Biển số xe',     required: true,  example: '29A12345', note: '2 chữ số + 1 chữ cái + 4-5 số' },
    { key: 'customerPhone', label: 'SĐT chủ xe',     required: true,  example: '0912345678', note: 'Khách hàng phải có trong hệ thống' },
    { key: 'vehicleType',   label: 'Loại xe',        required: true,  example: '',
      choices: vehicleTypes.map((vt) => vt.name),    note: 'Xem sheet Lựa chọn' },
    { key: 'brand',  label: 'Hãng xe',  required: false, example: 'Honda' },
    { key: 'model',  label: 'Model',    required: false, example: 'Wave Alpha' },
    { key: 'color',  label: 'Màu sắc',  required: false, example: 'Đỏ' },
  ];

  // Hai sheet TRA CỨU kèm trong file mẫu tải về: danh sách loại xe và danh sách khách hàng
  // hiện có. Không có hai sheet này thì người dùng phải mở song song màn hình khác để copy
  // đúng tên/SĐT - rất dễ gõ sai rồi cả file báo lỗi.
  const importRefSheets: ReferenceSheet[] = [
    {
      name: 'DS Loại xe',
      headers: ['Loại xe', 'Mô tả'],
      rows: vehicleTypes.map((vt) => [vt.name, vt.description ?? '']),
    },
    {
      name: 'DS Khách hàng',
      headers: ['Họ tên', 'SĐT'],
      rows: customers.map((c) => [c.fullName, c.phone ?? '']),
    },
  ];

  const handleImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      if (!row.licensePlate || !row.customerPhone || !row.vehicleType) {
        errors.push(`Dòng ${rowNum}: Thiếu Biển số, SĐT chủ xe hoặc Loại xe`);
        continue;
      }
      // ĐỔI TÊN THÀNH ID. API chỉ nhận customerId / vehicleTypeId, nhưng file Excel của người
      // dùng ghi SĐT và tên loại xe. Tra trong hai danh mục đã tải ở fetchData().
      // Tra ngay trên máy khách (không gọi API từng dòng) nên rất nhanh, và dòng nào không
      // khớp thì báo lỗi kèm đúng giá trị người dùng đã gõ để họ biết sửa gì.
      const customer = customers.find((c) => c.phone === row.customerPhone);
      if (!customer) { errors.push(`Dòng ${rowNum}: Không tìm thấy khách SĐT "${row.customerPhone}"`); continue; }
      // .trim() hai bên: người dùng copy từ Excel rất hay dính dấu cách ở đầu/cuối ô.
      const vt = vehicleTypes.find((vt) => vt.name.trim() === row.vehicleType.trim());
      if (!vt) { errors.push(`Dòng ${rowNum}: Không tìm thấy loại xe "${row.vehicleType}"`); continue; }
      try {
        await api.post('/vehicles', {
          licensePlate: normalizePlate(row.licensePlate),
          customerId: customer.id,
          vehicleTypeId: vt.id,
          brand: row.brand || undefined,
          model: row.model || undefined,
          color: row.color || undefined,
        });
        success++;
      } catch (err) {
        const error = err as AxiosError<{ message: string }>;
        errors.push(`Dòng ${rowNum}: ${error.response?.data?.message ?? 'Lỗi không xác định'}`);
      }
    }
    if (success > 0) fetchData();
    return { success, errors };
  };

  /* ══ KHỐI 5 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  const columns = [
    { title: t('colLicensePlate'), dataIndex: 'licensePlate', key: 'licensePlate', width: 140, render: (v: string) => <Tag className="plate-tag">{v}</Tag> },
    // Cột này KHÔNG có `dataIndex` vì dữ liệu nằm ở bảng liên kết (`r.customer.fullName`),
    // không phải field trực tiếp của xe. Backend đã join sẵn khi trả về.
    // `?.` và `|| '-'`: khách có thể đã bị ngừng hoạt động hoặc dữ liệu cũ thiếu liên kết,
    // không chặn thì màn hình trắng vì lỗi "đọc thuộc tính của undefined".
    { title: t('colOwner'), key: 'customerName', width: 180, ellipsis: true, render: (_: unknown, r: Vehicle) => r.customer?.fullName || '-' },
    { title: t('colVehicleType'), key: 'vehicleTypeName', width: 150, ellipsis: true, render: (_: unknown, r: Vehicle) => r.vehicleType?.name || '-' },
    { title: t('colBrand'), dataIndex: 'brand', key: 'brand', width: 130, ellipsis: true, render: (v?: string) => v || '-' },
    { title: t('colModel'), dataIndex: 'model', key: 'model', width: 150, ellipsis: true, render: (v?: string) => v || '-' },
    { title: t('colColor'), dataIndex: 'color', key: 'color', width: 110, ellipsis: true, render: (v?: string) => v || '-' },
    {
      // `parkingStatus` là field TÍNH TOÁN, không lưu trong bảng Vehicles: backend suy ra từ
      // việc xe có lượt gửi nào đang mở (status = 'parked') hay không. Lưu cứng vào bảng xe thì
      // mỗi lần xe vào/ra phải nhớ cập nhật hai nơi, lệch một lần là sai mãi.
      title: t('fieldStatus'), dataIndex: 'parkingStatus', key: 'parkingStatus', width: 150,
      render: (status?: string) => (
        <StatusTag
          domain="vehicleParking"
          value={status === 'parked' ? 'parked' : 'outside'}
          label={status === 'parked' ? t('statusParked') : t('statusOutside')}
        />
      ),
    },
    {
      title: t('fieldAction'), key: 'action', width: 220,
      render: (_: unknown, r: Vehicle) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PermissionGate screen="vehicles" action="update">
            <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">{t('btnEdit')}</Button>
          </PermissionGate>
          <PermissionGate screen="vehicles" action="delete">
            <Popconfirm title={t('confirmDelete')} onConfirm={() => handleDelete(r.id)}>
              <Button icon={<DeleteOutlined />} danger size="small">{t('btnDelete')}</Button>
            </Popconfirm>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pageVehicles')}</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <PermissionGate screen="vehicles" action="create">
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>{t('btnImport')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              {t('btnAddVehicle')}
            </Button>
          </Space>
        </PermissionGate>
      </div>
      <FilterBar onReset={resetFilters}>
        <Input.Search
          placeholder="Tìm biển số, chủ xe, hãng, model..."
          style={{ width: 320 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
          allowClear
        />
        <Select
          value={filters.customerId}
          allowClear
          placeholder="Lọc theo khách hàng"
          style={{ width: 220 }}
          onChange={(value) => setFilters((prev) => ({ ...prev, customerId: value }))}
          showSearch
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          options={customers.map((customer) => ({
            value: customer.id,
            label: `${customer.fullName} - ${customer.phone}`,
          }))}
        />
        <Select
          value={filters.vehicleTypeId}
          allowClear
          placeholder="Lọc theo loại xe"
          style={{ width: 180 }}
          onChange={(value) => setFilters((prev) => ({ ...prev, vehicleTypeId: value }))}
          options={vehicleTypes.map((vehicleType) => ({
            value: vehicleType.id,
            label: vehicleType.name,
          }))}
        />
        <Select
          value={filters.parkingStatus}
          allowClear
          placeholder="Trạng thái xe"
          style={{ width: 180 }}
          onChange={(value) => setFilters((prev) => ({ ...prev, parkingStatus: value }))}
          options={[
            { value: 'parked', label: 'Đang trong bãi' },
            { value: 'outside', label: 'Đang ở ngoài' },
          ]}
        />
      </FilterBar>
      <Card>
        <Table columns={columns} dataSource={vehicles} rowKey="id" loading={loading} pagination={defaultPagination({ pageSize: 10 })} />
      </Card>

      <ImportModal
        open={importOpen}
        title={t('menuVehicles')}
        columns={importColumns}
        referenceSheets={importRefSheets}
        onImport={handleImport}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        title={editing ? `${t('btnEdit')} ${t('menuVehicles').toLowerCase()}` : t('btnAddVehicle')}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? t('btnUpdate') : t('btnAdd')}
        cancelText={t('btnCancel')}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerId" label="Chủ xe" rules={[{ required: true, message: 'Vui lòng chọn chủ xe' }]}>
            <Select placeholder="Chọn khách hàng" showSearch filterOption={(input, option) => 
              String(option?.children).toLowerCase().includes(input.toLowerCase())
            }>
              {customers.map((c) => <Select.Option key={c.id} value={c.id}>{c.fullName} - {c.phone}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="vehicleTypeId" label="Loại xe" rules={[{ required: true, message: 'Vui lòng chọn loại xe' }]}>
            <Select placeholder="Chọn loại xe">
              {vehicleTypes.map((vt) => <Select.Option key={vt.id} value={vt.id}>{vt.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="licensePlate" label="Biển số xe" rules={[{ required: true, message: 'Vui lòng nhập biển số' }, { pattern: /^(\d{2}[A-Z]{1,2}\d{4,6}|[A-Z]{2}\d{3,5})$/, message: 'Biển số không đúng định dạng (VD: 29A87642, 59FA2345, hoặc mã nội bộ như XD001)' }]}>
            <Input placeholder="VD: 29A87642" style={{ textTransform: 'uppercase' }} onChange={(e) => form.setFieldsValue({ licensePlate: normalizePlate(e.target.value) })} />
          </Form.Item>
          <Form.Item name="brand" label="Hãng xe">
            <Input />
          </Form.Item>
          <Form.Item name="model" label="Model">
            <Input />
          </Form.Item>
          <Form.Item name="color" label="Màu sắc">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Vehicles;
