import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { Customer, CustomerForm } from '../types';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState<string>('');
  const [form] = Form.useForm<CustomerForm>();

  const fetchCustomers = async (searchTerm: string = '') => {
    setLoading(true);
    try {
      const res = await api.get<Customer[]>('/customers', { params: { search: searchTerm } });
      setCustomers(res.data);
    } catch (err) {
      message.error('Không tải được danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

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
      fetchCustomers(search);
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
      message.success('Xóa thành công');
      fetchCustomers(search);
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const columns = [
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName', render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (t?: string) => t || '-' },
    { title: 'CMND/CCCD', dataIndex: 'identityCard', key: 'identityCard', render: (t?: string) => t || '-' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address', render: (t?: string) => t || '-' },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: Customer) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
          <Popconfirm title="Xác nhận xóa?" onConfirm={() => handleDelete(r.id)}>
            <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý khách hàng</h2>
      <Card>
        <div className="toolbar">
          <Input.Search
            placeholder="Tìm theo tên, SĐT, CMND..."
            style={{ width: 300 }}
            onSearch={(v) => { setSearch(v); fetchCustomers(v); }}
            allowClear
          />
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
