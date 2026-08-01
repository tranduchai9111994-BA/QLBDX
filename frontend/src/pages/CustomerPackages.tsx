import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Select, DatePicker, message, Tag, Space, Input } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { CustomerPackage, Customer, ParkingPackage, Vehicle, CustomerPackageForm } from '../types';
import { useAuth } from '../context/AuthContext';

const { RangePicker } = DatePicker;

const CustomerPackages: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<ParkingPackage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editModal, setEditModal] = useState<boolean>(false);
  const [editingPkg, setEditingPkg] = useState<CustomerPackage | null>(null);
  const [editForm] = Form.useForm();
  const [form] = Form.useForm<CustomerPackageForm>();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: undefined as string | undefined,
    packageId: undefined as number | undefined,
    vehicleTypeId: undefined as number | undefined,
    fromDate: undefined as string | undefined,
    toDate: undefined as string | undefined,
  });
  const selectedCustomerId = Form.useWatch('customerId', form);
  const selectedVehicleId = Form.useWatch('vehicleId', form);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.packageId) params.packageId = filters.packageId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const [cpRes, cRes, pRes, vRes] = await Promise.all([
        api.get<CustomerPackage[]>('/customer-packages', { params }),
        api.get<Customer[]>('/customers'),
        api.get<ParkingPackage[]>('/packages'),
        api.get<Vehicle[]>('/vehicles'),
      ]);
      setCustomerPackages(cpRes.data);
      setCustomers(cRes.data);
      setPackages(pRes.data);
      setVehicles(vRes.data);
    } catch (err) {
      message.error('Không tải được dữ liệu gói dịch vụ khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);
  useEffect(() => {
    const currentVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    const currentPackage = packages.find((pkg) => pkg.id === form.getFieldValue('packageId'));

    if (currentVehicle && currentPackage && currentVehicle.vehicleTypeId !== currentPackage.vehicleTypeId) {
      form.setFieldValue('packageId', undefined);
    }
  }, [selectedVehicleId, vehicles, packages, form]);

  const filteredVehicles = vehicles.filter((vehicle) =>
    (!selectedCustomerId || vehicle.customerId === selectedCustomerId)
  );
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const filteredPackages = packages.filter((pkg) =>
    !selectedVehicle || pkg.vehicleTypeId === selectedVehicle.vehicleTypeId
  );

  const handleSubmit = async (values: CustomerPackageForm) => {
    try {
      const payload = {
        customerId: values.customerId,
        packageId: values.packageId,
        vehicleId: values.vehicleId,
        startDate: values.startDate.format('YYYY-MM-DD'),
      };
      await api.post('/customer-packages', payload);
      message.success('Đăng ký gói thành công');
      setModal(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: CustomerPackage) => {
    setEditingPkg(record);
    editForm.setFieldsValue({
      customerId: record.customerId,
      vehicleId: record.vehicleId,
      status: record.status,
    });
    setEditModal(true);
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingPkg) return;
    try {
      await api.put(`/customer-packages/${editingPkg.id}`, {
        customerId: values.customerId,
        vehicleId: values.vehicleId,
        status: values.status,
      });
      message.success('Cập nhật thành công');
      setEditModal(false);
      setEditingPkg(null);
      editForm.resetFields();
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleCancelPackage = (record: CustomerPackage) => {
    Modal.confirm({
      title: 'Xác nhận hủy gói',
      content: 'Gói sẽ được chuyển sang trạng thái "Đã hủy". Hệ thống giữ nguyên thanh toán và lịch sử liên quan.',
      okText: 'Hủy gói',
      cancelText: 'Đóng',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.put(`/customer-packages/${record.id}`, {
            customerId: record.customerId,
            vehicleId: record.vehicleId,
            status: 'cancelled',
          });
          message.success('Đã hủy gói dịch vụ');
          fetchData();
        } catch (err) {
          const error = err as AxiosError<{ message: string }>;
          message.error(error.response?.data?.message || 'Không thể hủy gói');
        }
      },
    });
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({
      search: '',
      status: undefined,
      packageId: undefined,
      vehicleTypeId: undefined,
      fromDate: undefined,
      toDate: undefined,
    });
  };

  const columns = [
    { title: 'Khách hàng', key: 'customerName', render: (_: any, r: CustomerPackage) => <span style={{ fontWeight: 500 }}>{r.customer?.fullName || '-'}</span> },
    { title: 'Gói', key: 'packageName', render: (_: any, r: CustomerPackage) => r.parkingPackage?.name || '-' },
    { title: 'Phương tiện', key: 'vehiclePlate', render: (_: any, r: CustomerPackage) => r.vehicle?.licensePlate || '-' },
    { title: 'Bắt đầu', dataIndex: 'startDate', key: 'startDate', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
    { title: 'Kết thúc', dataIndex: 'endDate', key: 'endDate', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (s: string) => s === 'active' ? <Tag className="chip-available">Hoạt động</Tag> : s === 'pending' ? <Tag color="gold">Chưa hiệu lực</Tag> : s === 'cancelled' ? <Tag color="red">Đã hủy</Tag> : <Tag>Hết hạn</Tag> },
    {
      title: 'Thao tác', key: 'action', width: 260, render: (_: any, r: CustomerPackage) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
              {r.status !== 'cancelled' && r.status !== 'expired' ? (
                <Button icon={<StopOutlined />} onClick={() => handleCancelPackage(r)} size="small" danger>Hủy gói</Button>
              ) : null}
            </>
          ) : (
            <Tag color="default">Staff chỉ được đăng ký mới</Tag>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Gói dịch vụ của khách hàng</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm khách hàng, biển số, tên gói..."
              style={{ width: 320 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
              allowClear
            />
            <Select
              value={filters.status}
              allowClear
              placeholder="Lọc theo trạng thái"
              style={{ width: 180 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              options={[
                { value: 'active', label: 'Hoạt động' },
                { value: 'pending', label: 'Chưa hiệu lực' },
                { value: 'expired', label: 'Hết hạn' },
                { value: 'cancelled', label: 'Đã hủy' },
              ]}
            />
            <Select
              value={filters.vehicleTypeId}
              allowClear
              placeholder="Lọc theo loại xe"
              style={{ width: 180 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, vehicleTypeId: value }))}
              options={Array.from(new Map(packages.map((pkg) => [pkg.vehicleTypeId, pkg.vehicleType?.name || `Loại ${pkg.vehicleTypeId}`])).entries()).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Select
              value={filters.packageId}
              allowClear
              placeholder="Lọc theo gói"
              style={{ width: 220 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, packageId: value }))}
              options={packages.map((pkg) => ({
                value: pkg.id,
                label: pkg.name,
              }))}
            />
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={(dates: [Dayjs | null, Dayjs | null] | null) => {
                setFilters((prev) => ({
                  ...prev,
                  fromDate: dates?.[0] ? dates[0].format('YYYY-MM-DD') : undefined,
                  toDate: dates?.[1] ? dates[1].format('YYYY-MM-DD') : undefined,
                }));
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>Xóa bộ lọc</Button>
          </Space>
          <div className="toolbar-right">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModal(true); }}>
              Đăng ký gói dịch vụ
            </Button>
          </div>
        </div>
        <Table columns={columns} dataSource={customerPackages} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title="Đăng ký gói dịch vụ"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Đăng ký"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}>
            <Select
              showSearch
              placeholder="Chọn khách hàng"
              onChange={() => {
                form.setFieldValue('vehicleId', undefined);
                form.setFieldValue('packageId', undefined);
              }}
              filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}
            >
              {customers.map((c) => <Select.Option key={c.id} value={c.id}>{c.fullName} - {c.phone}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="vehicleId" label="Phương tiện" rules={[{ required: true, message: 'Vui lòng chọn phương tiện' }]}>
            <Select showSearch placeholder="Chọn phương tiện" filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
              {filteredVehicles.map((v) => <Select.Option key={v.id} value={v.id}>{v.licensePlate} - {v.customer?.fullName || ''}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="packageId" label="Gói dịch vụ" rules={[{ required: true, message: 'Vui lòng chọn gói' }]}>
            <Select placeholder={selectedVehicle ? 'Chọn gói theo loại xe' : 'Chọn phương tiện trước để lọc gói'}>
              {filteredPackages.map((p) => <Select.Option key={p.id} value={p.id}>{p.name} - {Number(p.price).toLocaleString()}đ</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Cập nhật gói dịch vụ"
        open={editModal}
        onCancel={() => { setEditModal(false); setEditingPkg(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        okText="Cập nhật"
        cancelText="Hủy"
      >
        {editingPkg && (
          <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
            <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--surface-variant, #f5f5f5)', borderRadius: 8 }}>
              <div><strong>Gói:</strong> {editingPkg.parkingPackage?.name}</div>
              <div><strong>Thời hạn:</strong> {dayjs(editingPkg.startDate).format('DD/MM/YYYY')} - {dayjs(editingPkg.endDate).format('DD/MM/YYYY')}</div>
            </div>
            <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}>
              <Select showSearch placeholder="Chọn khách hàng" filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
                {customers.map((c) => <Select.Option key={c.id} value={c.id}>{c.fullName} - {c.phone}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="vehicleId" label="Phương tiện" rules={[{ required: true, message: 'Vui lòng chọn phương tiện' }]}>
              <Select showSearch placeholder="Chọn phương tiện" filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
                {vehicles.map((v) => <Select.Option key={v.id} value={v.id}>{v.licensePlate} - {v.customer?.fullName || ''}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="active">Hoạt động</Select.Option>
                <Select.Option value="pending">Chưa hiệu lực</Select.Option>
                <Select.Option value="expired">Hết hạn</Select.Option>
                <Select.Option value="cancelled">Đã hủy</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default CustomerPackages;
