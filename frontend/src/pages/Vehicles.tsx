import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, Select, message, Popconfirm, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { Vehicle, VehicleType, Customer, VehicleForm } from '../types';
import { useAuth } from '../context/AuthContext';

const Vehicles: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form] = Form.useForm<VehicleForm>();
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
    setFilters({
      search: '',
      customerId: undefined,
      vehicleTypeId: undefined,
      parkingStatus: undefined,
    });
  };

  const columns = [
    { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', render: (t: string) => <Tag className="plate-tag">{t}</Tag> },
    { title: 'Chủ xe', key: 'customerName', render: (_: any, r: Vehicle) => r.customer?.fullName || '-' },
    { title: 'Loại xe', key: 'vehicleTypeName', render: (_: any, r: Vehicle) => r.vehicleType?.name || '-' },
    { title: 'Hãng', dataIndex: 'brand', key: 'brand', render: (t?: string) => t || '-' },
    { title: 'Model', dataIndex: 'model', key: 'model', render: (t?: string) => t || '-' },
    { title: 'Màu', dataIndex: 'color', key: 'color', render: (t?: string) => t || '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'parkingStatus',
      key: 'parkingStatus',
      render: (status?: string) => status === 'parked' ? <Tag color="red">Đang trong bãi</Tag> : <Tag color="green">Đang ở ngoài</Tag>,
    },
    {
      title: 'Thao tác', key: 'action', width: 220, render: (_: any, r: Vehicle) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
          {isAdmin ? (
            <Popconfirm title="Xác nhận xóa xe này?" onConfirm={() => handleDelete(r.id)}>
              <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
            </Popconfirm>
          ) : (
            <Tag color="default">Chỉ admin được xóa</Tag>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý phương tiện</h2>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              Thêm phương tiện
            </Button>
          </div>
        </div>
        <Table columns={columns} dataSource={vehicles} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editing ? 'Sửa phương tiện' : 'Thêm phương tiện'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
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
