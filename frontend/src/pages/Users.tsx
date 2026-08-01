import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, Select, message, Tag, Row, Col, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { User, UserForm } from '../types';
import { useAuth } from '../context/AuthContext';

const roleLabels: Record<string, string> = {
  admin: 'Quản trị',
  staff: 'Nhân viên',
};

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
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
      phone: record.phone,
      role: record.role,
      isActive: record.isActive,
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

  const filteredUsers = users
    .filter((u) => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      return [u.username, u.fullName, u.email, u.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .filter((u) => roleFilter === 'all' || u.role === roleFilter)
    .filter((u) => statusFilter === 'all' || (statusFilter === 'active' ? u.isActive : !u.isActive));

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'username', render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (t?: string) => t || '-' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone', render: (t?: string) => t || '-' },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      render: (r: string) => r === 'admin' ? <Tag color="red">Admin</Tag> : <Tag className="chip-available">Nhân viên</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive?: boolean) => isActive === false ? <Tag color="default">Ngừng hoạt động</Tag> : <Tag color="green">Đang hoạt động</Tag>,
    },
    {
      title: 'Thao tác', key: 'action', width: 180, render: (_: any, r: User) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small" disabled={r.id === currentUser?.id}>Sửa</Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger disabled={r.id === currentUser?.id}>Xóa</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý người dùng</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Nhóm Quản trị (Admin)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Tag color="red" style={{ width: 'fit-content' }}>Toàn quyền cấu hình và báo cáo</Tag>
              <span>Được quản lý người dùng, báo cáo, thanh toán, bãi đỗ, loại xe và gói dịch vụ.</span>
              <span>API backend kiểm tra trực tiếp theo role hiện tại, không chỉ dựa vào menu giao diện.</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Nhóm Nhân viên (Staff)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Tag className="chip-available" style={{ width: 'fit-content' }}>Tác nghiệp vận hành hàng ngày</Tag>
              <span>Được thao tác xe vào/ra, khách hàng, phương tiện và đăng ký gói cho khách.</span>
              <span>Các chức năng quản trị chỉ hiển thị dạng xem hoặc bị ẩn để tránh lệch với quyền API.</span>
            </div>
          </Card>
        </Col>
      </Row>
      <Card>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Hệ thống hiện dùng RBAC đơn giản với 2 nhóm cứng: Admin và Staff"
          description="Chưa có bảng Role/Group riêng trong cơ sở dữ liệu. Việc phân nhóm được thực hiện qua trường role của bảng Users."
        />
        <div className="toolbar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Input.Search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm username, họ tên, email..."
              allowClear
              style={{ width: 260 }}
            />
            <Select value={roleFilter} onChange={setRoleFilter} style={{ width: 180 }}>
              <Select.Option value="all">Tất cả vai trò</Select.Option>
              <Select.Option value="admin">{roleLabels.admin}</Select.Option>
              <Select.Option value="staff">{roleLabels.staff}</Select.Option>
            </Select>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 180 }}>
              <Select.Option value="all">Tất cả trạng thái</Select.Option>
              <Select.Option value="active">Đang hoạt động</Select.Option>
              <Select.Option value="inactive">Ngừng hoạt động</Select.Option>
            </Select>
            <Button onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}>
              Xóa bộ lọc
            </Button>
          </div>
          <div className="toolbar-right">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              Thêm người dùng
            </Button>
          </div>
        </div>
        <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading} />
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
          <Form.Item name="phone" label="Số điện thoại">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select placeholder="Chọn vai trò">
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="staff">Nhân viên</Select.Option>
            </Select>
          </Form.Item>
          {editing && (
            <Form.Item name="isActive" label="Trạng thái" rules={[{ required: true }]}>
              <Select>
                <Select.Option value={true}>Đang hoạt động</Select.Option>
                <Select.Option value={false}>Ngừng hoạt động</Select.Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: !editing, message: 'Vui lòng nhập mật khẩu' }]}>
            <Input.Password placeholder={editing ? 'Để trống nếu không đổi' : ''} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
