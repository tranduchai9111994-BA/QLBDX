import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { User, UserForm } from '../types';
import { useAuth } from '../context/AuthContext';

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm<UserForm>();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch (err) {
      message.error('Không tải được danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (values: UserForm) => {
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/users', values);
        message.success('Thêm người dùng thành công');
      }
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchUsers();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: User) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      fullName: record.fullName,
      email: record.email,
      role: record.role,
      password: undefined, // Don't populate password for edit
    });
    setModal(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Nếu người dùng đã phát sinh dữ liệu, hệ thống sẽ chuyển sang ngừng hoạt động thay vì xóa cứng.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await api.delete(`/users/${id}`);
          message.success('Xóa thành công');
          fetchUsers();
        } catch (err) {
          const error = err as AxiosError<{ message: string }>;
          message.error(error.response?.data?.message || 'Có lỗi xảy ra');
        }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'username', render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (t?: string) => t || '-' },
    { title: 'Vai trò', dataIndex: 'role', key: 'role', render: (r: string) => r === 'admin' ? <Tag color="red">Admin</Tag> : <Tag className="chip-available">Nhân viên</Tag> },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: User) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger>Xóa</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý người dùng</h2>
      <Card>
        <div className="toolbar">
          <div className="toolbar-right">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              Thêm người dùng
            </Button>
          </div>
        </div>
        <Table columns={columns} dataSource={users.filter(u => u.id !== currentUser?.id)} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa người dùng' : 'Thêm người dùng'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select placeholder="Chọn vai trò">
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="staff">Nhân viên</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: !editing, message: 'Vui lòng nhập mật khẩu' }]}>
            <Input.Password placeholder={editing ? 'Để trống nếu không đổi' : ''} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
