import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, message, Popconfirm, Select, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { Customer, CustomerForm } from '../types';
import { useAuth } from '../context/AuthContext';

const Customers: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });
  const [form] = Form.useForm<CustomerForm>();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = { includeInactive: true };
      if (filters.search) params.search = filters.search;
      if (filters.status === 'active') params.isActive = true;
      if (filters.status === 'inactive') params.isActive = false;
      const res = await api.get<Customer[]>('/customers', { params });
      setCustomers(res.data);
    } catch (err) {
      message.error('Không tải được danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [filters]);

  const handleSubmit = async (values: CustomerForm) => {
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/customers', values);
        message.success('Thêm khách hàng thành công');
      }
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchCustomers();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: Customer) => {
    setEditing(record);
    form.setFieldsValue({
      fullName: record.fullName,
      phone: record.phone,
      email: record.email,
      address: record.address,
      identityCard: record.identityCard,
    });
    setModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/customers/${id}`);
      message.success('Ngừng hoạt động khách hàng thành công');
      fetchCustomers();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({ search: '', status: 'all' });
  };

  const columns = [
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName', render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (t?: string) => t || '-' },
    { title: 'CMND/CCCD', dataIndex: 'identityCard', key: 'identityCard', render: (t?: string) => t || '-' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address', render: (t?: string) => t || '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => isActive ? <Tag color="green">Đang hoạt động</Tag> : <Tag>Ngừng hoạt động</Tag>,
    },
    {
      title: 'Thao tác', key: 'action', width: 220, render: (_: any, r: Customer) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
          {isAdmin ? (
            <Popconfirm title="Ngừng hoạt động khách hàng này?" onConfirm={() => handleDelete(r.id)}>
              <Button icon={<DeleteOutlined />} danger size="small" disabled={!r.isActive}>Ngừng hoạt động</Button>
            </Popconfirm>
          ) : (
            <Tag color="default">Chỉ admin được ngừng</Tag>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý khách hàng</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm tên, SĐT, CCCD, email..."
              style={{ width: 320 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
              allowClear
            />
            <Select
              value={filters.status}
              style={{ width: 190 }}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'inactive', label: 'Ngừng hoạt động' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>Xóa bộ lọc</Button>
          </Space>
          <div className="toolbar-right">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              Thêm khách hàng
            </Button>
          </div>
        </div>
        <Table columns={columns} dataSource={customers} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập SĐT' }, { pattern: /^[0-9\s.+-]{8,15}$/, message: 'Số điện thoại không hợp lệ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="identityCard" label="CMND/CCCD" rules={[{ pattern: /^[0-9]{9,12}$/, message: 'CMND/CCCD phải gồm 9-12 chữ số' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Customers;
