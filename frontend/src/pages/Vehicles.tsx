import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, Select, message, Popconfirm, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { Vehicle, VehicleType, Customer, VehicleForm } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ImportModal, { ColumnDef, ReferenceSheet } from '../components/ImportModal';

const Vehicles: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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

  const normalizePlate = (val: string) => val.replace(/[-\s.]/g, '').toUpperCase();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filters.search) params.search = filters.search;
      if (filters.customerId) params.customerId = filters.customerId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      if (filters.parkingStatus) params.parkingStatus = filters.parkingStatus;

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

  const handleSubmit = async (values: VehicleForm) => {
    try {
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

  /* ── Import ─────────────────────────────────────────────────── */
  const importColumns: ColumnDef[] = [
    { key: 'licensePlate',  label: 'Biển số xe',     required: true,  example: '29A12345', note: '2 chữ số + 1 chữ cái + 4-5 số' },
    { key: 'customerPhone', label: 'SĐT chủ xe',     required: true,  example: '0912345678', note: 'Khách hàng phải có trong hệ thống' },
    { key: 'vehicleType',   label: 'Loại xe',        required: true,  example: '',
      choices: vehicleTypes.map((vt) => vt.name),    note: 'Xem sheet Lựa chọn' },
    { key: 'brand',  label: 'Hãng xe',  required: false, example: 'Honda' },
    { key: 'model',  label: 'Model',    required: false, example: 'Wave Alpha' },
    { key: 'color',  label: 'Màu sắc',  required: false, example: 'Đỏ' },
  ];

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
      const customer = customers.find((c) => c.phone === row.customerPhone);
      if (!customer) { errors.push(`Dòng ${rowNum}: Không tìm thấy khách SĐT "${row.customerPhone}"`); continue; }
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

  const columns = [
    { title: t('colLicensePlate'), dataIndex: 'licensePlate', key: 'licensePlate', render: (v: string) => <Tag className="plate-tag">{v}</Tag> },
    { title: t('colOwner'), key: 'customerName', render: (_: unknown, r: Vehicle) => r.customer?.fullName || '-' },
    { title: t('colVehicleType'), key: 'vehicleTypeName', render: (_: unknown, r: Vehicle) => r.vehicleType?.name || '-' },
    { title: t('colBrand'), dataIndex: 'brand', key: 'brand', render: (v?: string) => v || '-' },
    { title: t('colModel'), dataIndex: 'model', key: 'model', render: (v?: string) => v || '-' },
    { title: t('colColor'), dataIndex: 'color', key: 'color', render: (v?: string) => v || '-' },
    {
      title: t('fieldStatus'), dataIndex: 'parkingStatus', key: 'parkingStatus',
      render: (status?: string) => status === 'parked'
        ? <Tag color="red">{t('statusParked')}</Tag>
        : <Tag color="green">{t('statusOutside')}</Tag>,
    },
    {
      title: t('fieldAction'), key: 'action', width: 220,
      render: (_: unknown, r: Vehicle) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">{t('btnEdit')}</Button>
          {isAdmin ? (
            <Popconfirm title={t('confirmDelete')} onConfirm={() => handleDelete(r.id)}>
              <Button icon={<DeleteOutlined />} danger size="small">{t('btnDelete')}</Button>
            </Popconfirm>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pageVehicles')}</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
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
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>Xóa bộ lọc</Button>
          </Space>
          <div className="toolbar-right">
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>{t('btnImport')}</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
                {t('btnAddVehicle')}
              </Button>
            </Space>
          </div>
        </div>
        <Table columns={columns} dataSource={vehicles} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <ImportModal
        open={importOpen}
        title="Phương tiện"
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
          <Form.Item name="licensePlate" label="Biển số xe" rules={[{ required: true, message: 'Vui lòng nhập biển số' }, { pattern: /^\d{2}[A-Z]\d{4,5}$/, message: 'Biển số không đúng định dạng (VD: 29A87642)' }]}>
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
