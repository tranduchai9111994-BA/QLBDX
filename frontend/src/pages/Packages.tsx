import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, InputNumber, Select, message, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { ParkingPackage, VehicleType, PackageForm } from '../types';
import { useAuth } from '../context/AuthContext';

const Packages: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const [packages, setPackages] = useState<ParkingPackage[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<ParkingPackage | null>(null);
  const [form] = Form.useForm<PackageForm>();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    vehicleTypeId: undefined as number | undefined,
    status: 'all',
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    minDuration: undefined as number | undefined,
    maxDuration: undefined as number | undefined,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { includeInactive: true };
      if (filters.search) params.search = filters.search;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      if (filters.status === 'active') params.isActive = true;
      if (filters.status === 'inactive') params.isActive = false;
      if (filters.minPrice !== undefined) params.minPrice = filters.minPrice;
      if (filters.maxPrice !== undefined) params.maxPrice = filters.maxPrice;
      if (filters.minDuration !== undefined) params.minDuration = filters.minDuration;
      if (filters.maxDuration !== undefined) params.maxDuration = filters.maxDuration;

      const [pRes, vtRes] = await Promise.all([
        api.get<ParkingPackage[]>('/packages', { params }),
        api.get<VehicleType[]>('/vehicle-types'),
      ]);
      setPackages(pRes.data);
      setVehicleTypes(vtRes.data);
    } catch (err) {
      message.error('Không tải được danh sách gói dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

  const handleSubmit = async (values: PackageForm) => {
    try {
      if (editing) {
        await api.put(`/packages/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/packages', values);
        message.success('Thêm gói thành công');
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

  const handleEdit = (record: ParkingPackage) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      vehicleTypeId: record.vehicleTypeId,
      durationDays: record.durationDays,
      price: record.price,
      description: record.description,
    });
    setModal(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Nếu gói đã được sử dụng, hệ thống sẽ chặn xóa và yêu cầu ngừng áp dụng thay vì xóa cứng.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/packages/${id}`);
          message.success('Xóa thành công');
          fetchData();
        } catch (err) {
          const error = err as AxiosError<{ message: string }>;
          message.error(error.response?.data?.message || 'Không thể xóa');
        }
      },
    });
  };

  const handleToggleActive = async (record: ParkingPackage, isActive: boolean) => {
    try {
      await api.put(`/packages/${record.id}`, {
        name: record.name,
        vehicleTypeId: record.vehicleTypeId,
        durationDays: record.durationDays,
        price: record.price,
        description: record.description,
        isActive,
      });
      message.success(isActive ? 'Đã kích hoạt lại gói dịch vụ' : 'Đã ngừng áp dụng gói dịch vụ');
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Không thể cập nhật trạng thái gói');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({
      search: '',
      vehicleTypeId: undefined,
      status: 'all',
      minPrice: undefined,
      maxPrice: undefined,
      minDuration: undefined,
      maxDuration: undefined,
    });
  };

  const columns = [
    { title: 'Tên gói', dataIndex: 'name', key: 'name', render: (value: string) => <span style={{ fontWeight: 500 }}>{value}</span> },
    { title: 'Loại xe', key: 'vehicleTypeName', render: (_: any, r: ParkingPackage) => r.vehicleType?.name || '-' },
    { title: 'Thời hạn (ngày)', dataIndex: 'durationDays', key: 'durationDays' },
    { title: 'Giá (đ)', dataIndex: 'price', key: 'price', render: (v: number) => Number(v).toLocaleString() },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (t?: string) => t || '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => isActive ? <Tag color="green">Đang áp dụng</Tag> : <Tag>Ngừng áp dụng</Tag>,
    },
    {
      title: 'Thao tác', key: 'action', width: 320, render: (_: any, r: ParkingPackage) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
              {r.isActive ? (
                <Button icon={<StopOutlined />} onClick={() => handleToggleActive(r, false)} size="small">Ngừng áp dụng</Button>
              ) : (
                <Button icon={<CheckCircleOutlined />} onClick={() => handleToggleActive(r, true)} size="small" type="primary" ghost>Kích hoạt lại</Button>
              )}
              <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger>Xóa</Button>
            </>
          ) : (
            <Tag color="default">Chỉ quản trị được sửa</Tag>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý gói dịch vụ</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm tên gói, mô tả, loại xe..."
              style={{ width: 320 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
              allowClear
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
              value={filters.status}
              style={{ width: 180 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'active', label: 'Đang áp dụng' },
                { value: 'inactive', label: 'Ngừng áp dụng' },
              ]}
            />
            <InputNumber
              placeholder="Giá từ"
              style={{ width: 130 }}
              value={filters.minPrice}
              onChange={(value) => setFilters((prev) => ({ ...prev, minPrice: value ?? undefined }))}
              min={0}
            />
            <InputNumber
              placeholder="Giá đến"
              style={{ width: 130 }}
              value={filters.maxPrice}
              onChange={(value) => setFilters((prev) => ({ ...prev, maxPrice: value ?? undefined }))}
              min={0}
            />
            <InputNumber
              placeholder="Ngày từ"
              style={{ width: 120 }}
              value={filters.minDuration}
              onChange={(value) => setFilters((prev) => ({ ...prev, minDuration: value ?? undefined }))}
              min={1}
            />
            <InputNumber
              placeholder="Ngày đến"
              style={{ width: 120 }}
              value={filters.maxDuration}
              onChange={(value) => setFilters((prev) => ({ ...prev, maxDuration: value ?? undefined }))}
              min={1}
            />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>Xóa bộ lọc</Button>
          </Space>
          <div className="toolbar-right">
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
                Thêm gói dịch vụ
              </Button>
            )}
          </div>
        </div>
        <Table columns={columns} dataSource={packages} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Tên gói" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="vehicleTypeId" label="Loại xe" rules={[{ required: true }]}>
            <Select placeholder="Chọn loại xe">
              {vehicleTypes.map((vt) => <Select.Option key={vt.id} value={vt.id}>{vt.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="durationDays" label="Thời hạn (ngày)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="price" label="Giá (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Packages;
