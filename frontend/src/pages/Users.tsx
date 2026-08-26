import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Card, Modal, Form, Input, Select, message, Tag,
  Tabs, Tooltip, Badge, Space, Radio,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, StopOutlined, SettingOutlined, UndoOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { User, UserForm } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  SCREENS, ScreenDef, AccessLevel, StaffPermMap,
  loadStaffPerms, saveStaffPerms, resetStaffPerms, getStaffVisibleKeys,
  SCREEN_ROUTE_MAP,
} from '../utils/permConfig';
import { useLanguage } from '../context/LanguageContext';
import StatusTag from '../components/StatusTag';
import { confirmDanger } from '../utils/confirmDanger';
import { defaultPagination } from '../utils/tablePagination';

const ACCESS_LABEL: Record<AccessLevel, { text: string; color: string }> = {
  full:   { text: 'Đầy đủ',  color: '#52c41a' },
  view:   { text: 'Chỉ xem', color: '#1677ff' },
  hidden: { text: 'Ẩn',      color: '#d9d9d9' },
};

const GROUP_ORDER = ['Chung', 'Ra / Vào', 'Hạ tầng', 'Nghiệp vụ', 'Danh mục', 'Quản trị', 'Hệ thống'];

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [form] = Form.useForm<UserForm>();

  // Perm config state
  const [staffPerms, setStaffPerms] = useState<StaffPermMap>(loadStaffPerms);
  const [permEditing, setPermEditing] = useState(false);
  const [draftPerms, setDraftPerms] = useState<StaffPermMap>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch {
      message.error('Không tải được danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── User CRUD ───────────────────────────────────────────────── */
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
    form.setFieldsValue({ ...record, password: undefined });
    setModal(true);
  };

  const handleDelete = (id: number) => {
    confirmDanger({
      content: 'Nếu người dùng đã phát sinh dữ liệu, hệ thống sẽ chuyển sang ngừng hoạt động thay vì xóa cứng.',
      successMessage: 'Xóa thành công',
      onConfirm: async () => {
        await api.delete(`/users/${id}`);
        fetchUsers();
      },
    });
  };

  /* ── Permission config ───────────────────────────────────────── */
  const openPermEdit = () => {
    setDraftPerms({ ...staffPerms });
    setPermEditing(true);
  };

  const savePerms = () => {
    saveStaffPerms(draftPerms);
    setStaffPerms({ ...draftPerms });
    setPermEditing(false);
    message.success('Đã lưu cấu hình phân quyền. Nhân viên cần đăng nhập lại để áp dụng.');
    // Dispatch storage event so MainLayout picks it up without reload
    window.dispatchEvent(new Event('storage'));
  };

  const handleResetPerms = () => {
    const defaults = resetStaffPerms();
    setStaffPerms(defaults);
    setDraftPerms(defaults);
    message.info('Đã khôi phục về mặc định');
    window.dispatchEvent(new Event('storage'));
  };

  /* ── Filtered users ──────────────────────────────────────────── */
  const filteredUsers = users
    .filter((u) => {
      const kw = search.trim().toLowerCase();
      return !kw || [u.username, u.fullName, u.email, u.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(kw));
    })
    .filter((u) => roleFilter === 'all' || u.role === roleFilter)
    .filter((u) => statusFilter === 'all' || (statusFilter === 'active' ? u.isActive : !u.isActive));

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: t('colUsername'), dataIndex: 'username', key: 'username', render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: t('colFullName'), dataIndex: 'fullName', key: 'fullName' },
    { title: t('fieldEmail'), dataIndex: 'email', key: 'email', render: (v?: string) => v || '-' },
    { title: t('fieldPhone'), dataIndex: 'phone', key: 'phone', render: (v?: string) => v || '-' },
    {
      title: t('fieldRole'), dataIndex: 'role', key: 'role',
      render: (r: string) => r === 'admin'
        ? <Tag color="red">{t('userRoleAdmin')}</Tag>
        : <Tag className="chip-available">{t('userRoleStaff')}</Tag>,
    },
    {
      title: t('fieldStatus'), dataIndex: 'isActive', key: 'isActive',
      render: (v?: boolean) => (
        <StatusTag domain="user" value={v !== false} label={v === false ? t('statusInactive') : t('statusActive')} />
      ),
    },
    {
      title: t('fieldAction'), key: 'action', width: 180,
      render: (_: unknown, r: User) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small" disabled={r.id === currentUser?.id}>{t('btnEdit')}</Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger disabled={r.id === currentUser?.id}>{t('btnDelete')}</Button>
        </Space>
      ),
    },
  ];

  /* ── Bulk-set helpers ────────────────────────────────────────── */
  const bulkSetDraft = (level: AccessLevel) => {
    const next: StaffPermMap = {};
    SCREENS.filter((s) => s.configurable).forEach((s) => { next[s.key] = level; });
    setDraftPerms((prev) => ({ ...prev, ...next }));
  };

  /* ── Permission matrix — inline Radio.Group ──────────────────── */
  const renderPermMatrix = () => (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Ma trận phân quyền chức năng</span>
          <span style={{ marginLeft: 8, color: '#888', fontSize: 13 }}>
            — Admin luôn có toàn quyền. Click radio để thay đổi quyền Nhân viên.
          </span>
        </div>
        <Space wrap>
          {permEditing && (
            <>
              <span style={{ fontSize: 12, color: '#666' }}>Đặt tất cả:</span>
              <Button size="small" onClick={() => bulkSetDraft('hidden')}>Ẩn hết</Button>
              <Button size="small" onClick={() => bulkSetDraft('view')} style={{ color: '#1677ff', borderColor: '#1677ff' }}>Xem hết</Button>
              <Button size="small" onClick={() => bulkSetDraft('full')} style={{ color: '#52c41a', borderColor: '#52c41a' }}>Đầy đủ hết</Button>
              <Button type="primary" onClick={savePerms} icon={<CheckCircleOutlined />}>Lưu</Button>
              <Button onClick={() => { setPermEditing(false); setDraftPerms({}); }}>Hủy</Button>
            </>
          )}
          {!permEditing && (
            <>
              <Tooltip title="Khôi phục về mặc định hệ thống">
                <Button icon={<UndoOutlined />} size="small" onClick={handleResetPerms}>Reset</Button>
              </Tooltip>
              <Button type="primary" icon={<SettingOutlined />} onClick={openPermEdit}>
                Chỉnh sửa quyền Nhân viên
              </Button>
            </>
          )}
        </Space>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'linear-gradient(90deg,#0e3a6e,#1677ff)', color: '#fff' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', width: 200 }}>Chức năng</th>
            <th style={{ padding: '10px 14px', textAlign: 'center', width: 110, color: '#ffd' }}>Admin</th>
            <th style={{ padding: '10px 14px', textAlign: 'center' }}>
              Nhân viên
              {permEditing && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>(đang chỉnh sửa)</span>}
            </th>
          </tr>
        </thead>
        <tbody>
          {GROUP_ORDER.map((group) => {
            const rows = SCREENS.filter((s) => s.group === group);
            if (!rows.length) return null;
            return (
              <React.Fragment key={group}>
                <tr>
                  <td colSpan={3} style={{ padding: '7px 14px', background: '#f0f4ff', fontWeight: 700, color: '#0e3a6e', fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {group}
                  </td>
                </tr>
                {rows.map((s, i) => {
                  const effectiveLevel: AccessLevel = permEditing
                    ? (draftPerms[s.key] ?? staffPerms[s.key] ?? s.defaultStaffLevel)
                    : (staffPerms[s.key] ?? s.defaultStaffLevel);
                  return (
                    <tr key={s.key} style={{ background: i % 2 === 0 ? '#fff' : '#fafcff', borderBottom: '1px solid #eef0f8' }}>
                      <td style={{ padding: '10px 14px', color: '#222' }}>
                        {s.label}
                        {!s.configurable && (
                          <Tooltip title="Quyền cố định theo thiết kế, không thể thay đổi">
                            <LockOutlined style={{ marginLeft: 6, color: '#ccc', fontSize: 11 }} />
                          </Tooltip>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Tag color="red" style={{ fontSize: 12 }}>Đầy đủ</Tag>
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 14px' }}>
                        {s.configurable ? (
                          <Radio.Group
                            value={effectiveLevel}
                            onChange={(e) => {
                              if (!permEditing) return;
                              setDraftPerms((prev) => ({ ...prev, [s.key]: e.target.value as AccessLevel }));
                            }}
                            optionType="button"
                            buttonStyle="solid"
                            size="small"
                            disabled={!permEditing}
                          >
                            <Radio.Button value="hidden" style={effectiveLevel === 'hidden' ? { background: '#ff4d4f', borderColor: '#ff4d4f' } : {}}>Ẩn</Radio.Button>
                            <Radio.Button value="view" style={effectiveLevel === 'view' ? { background: '#1677ff', borderColor: '#1677ff' } : {}}>Chỉ xem</Radio.Button>
                            <Radio.Button value="full" style={effectiveLevel === 'full' ? { background: '#52c41a', borderColor: '#52c41a' } : {}}>Đầy đủ</Radio.Button>
                          </Radio.Group>
                        ) : (
                          <Tag color={effectiveLevel === 'full' ? 'green' : effectiveLevel === 'view' ? 'blue' : 'default'}>
                            {ACCESS_LABEL[effectiveLevel].text}
                          </Tag>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div>
      <h2 className="page-title">{t('pageUsers')}</h2>

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: t('tabUserList'),
            children: (
              <Card>
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
                      <Select.Option value="admin">Quản trị</Select.Option>
                      <Select.Option value="staff">Nhân viên</Select.Option>
                    </Select>
                    <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 180 }}>
                      <Select.Option value="all">Tất cả trạng thái</Select.Option>
                      <Select.Option value="active">Đang hoạt động</Select.Option>
                      <Select.Option value="inactive">Ngừng hoạt động</Select.Option>
                    </Select>
                    <Button onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); }}>
                      {t('btnReset')}
                    </Button>
                  </div>
                  <div className="toolbar-right">
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
                      {t('btnAddUser')}
                    </Button>
                  </div>
                </div>
                <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading} pagination={defaultPagination({ pageSize: 10 })} />
              </Card>
            ),
          },
          {
            key: 'permissions',
            label: (
              <span>
                <SettingOutlined style={{ marginRight: 6 }} />
                {t('tabPermissions')}
              </span>
            ),
            children: (
              <Card>{renderPermMatrix()}</Card>
            ),
          },
        ]}
      />

      {/* Add / Edit user modal */}
      <Modal
        title={editing ? `${t('btnEdit')} ${t('menuUsers').toLowerCase()}` : t('btnAddUser')}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? t('btnUpdate') : t('btnAdd')}
        cancelText={t('btnCancel')}
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
