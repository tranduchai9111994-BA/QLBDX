import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Card, Modal, Form, Input, Select, message, Tag,
  Tabs, Tooltip, Space, Checkbox, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SettingOutlined, TeamOutlined,
} from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { User, UserForm, PermissionGroup, GroupPermission } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import StatusTag from '../components/StatusTag';
import { confirmDanger } from '../utils/confirmDanger';
import { defaultPagination } from '../utils/tablePagination';

interface ScreenDef {
  key: string;
  label: string;
  group: string;
}

const GROUP_ORDER = ['Hạ tầng', 'Nghiệp vụ', 'Danh mục', 'Quản trị'];

type DraftRow = { canCreate: boolean; canUpdate: boolean; canDelete: boolean };

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
  const watchedRole = Form.useWatch('role', form);

  /* ── Permission groups state ─────────────────────────────────── */
  const [screens, setScreens] = useState<ScreenDef[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [groupForm] = Form.useForm<{ name: string; description?: string }>();

  const [matrixGroup, setMatrixGroup] = useState<PermissionGroup | null>(null);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, DraftRow>>({});
  const [matrixSaving, setMatrixSaving] = useState(false);

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

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const [screensRes, groupsRes] = await Promise.all([
        api.get<ScreenDef[]>('/permission-groups/screens'),
        api.get<PermissionGroup[]>('/permission-groups'),
      ]);
      setScreens(screensRes.data);
      setGroups(groupsRes.data);
    } catch {
      message.error('Không tải được danh sách nhóm quyền');
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); fetchGroups(); }, [fetchUsers, fetchGroups]);

  /* ── User CRUD ───────────────────────────────────────────────── */
  const handleSubmit = async (values: UserForm) => {
    try {
      const payload = { ...values, permissionGroupId: values.role === 'admin' ? null : values.permissionGroupId };
      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/users', payload);
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
    form.setFieldsValue({ ...record, password: undefined, permissionGroupId: record.permissionGroupId ?? undefined });
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

  /* ── Filtered users ──────────────────────────────────────────── */
  const filteredUsers = users
    .filter((u) => {
      const kw = search.trim().toLowerCase();
      return !kw || [u.username, u.fullName, u.email, u.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(kw));
    })
    .filter((u) => roleFilter === 'all' || u.role === roleFilter)
    .filter((u) => statusFilter === 'all' || (statusFilter === 'active' ? u.isActive : !u.isActive));

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60, ellipsis: true },
    { title: t('colUsername'), dataIndex: 'username', key: 'username', width: 140, ellipsis: true, render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: t('colFullName'), dataIndex: 'fullName', key: 'fullName', width: 170, ellipsis: true },
    { title: t('fieldEmail'), dataIndex: 'email', key: 'email', width: 190, ellipsis: true, render: (v?: string) => v || '-' },
    {
      title: t('fieldRole'), dataIndex: 'role', key: 'role', width: 110,
      render: (r: string) => r === 'admin'
        ? <Tag color="red">{t('userRoleAdmin')}</Tag>
        : <Tag className="chip-available">{t('userRoleStaff')}</Tag>,
    },
    {
      title: 'Nhóm quyền', key: 'permissionGroup', width: 160, ellipsis: true,
      render: (_: unknown, r: User) => r.role === 'admin'
        ? <span style={{ color: 'var(--outline)' }}>Toàn quyền</span>
        : r.permissionGroup
          ? <Tag color="blue">{r.permissionGroup.name}</Tag>
          : <Tag color="default">Chưa gán</Tag>,
    },
    {
      title: t('fieldStatus'), dataIndex: 'isActive', key: 'isActive', width: 130,
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

  /* ── Group CRUD ──────────────────────────────────────────────── */
  const openAddGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    setGroupModal(true);
  };
  const openEditGroup = (g: PermissionGroup) => {
    setEditingGroup(g);
    groupForm.setFieldsValue({ name: g.name, description: g.description ?? undefined });
    setGroupModal(true);
  };
  const handleGroupSubmit = async (values: { name: string; description?: string }) => {
    try {
      if (editingGroup) {
        await api.put(`/permission-groups/${editingGroup.id}`, values);
        message.success('Cập nhật nhóm quyền thành công');
      } else {
        await api.post('/permission-groups', values);
        message.success('Tạo nhóm quyền thành công');
      }
      setGroupModal(false);
      fetchGroups();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };
  const handleDeleteGroup = async (g: PermissionGroup) => {
    try {
      await api.delete(`/permission-groups/${g.id}`);
      message.success('Đã xoá nhóm quyền');
      fetchGroups();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Không xoá được nhóm quyền');
    }
  };

  /* ── Group permission matrix ─────────────────────────────────── */
  const openMatrix = (g: PermissionGroup) => {
    setMatrixGroup(g);
    const draft: Record<string, DraftRow> = {};
    for (const s of screens) {
      const existing = (g.permissions || []).find((p) => p.screenKey === s.key);
      draft[s.key] = existing
        ? { canCreate: existing.canCreate, canUpdate: existing.canUpdate, canDelete: existing.canDelete }
        : { canCreate: false, canUpdate: false, canDelete: false };
    }
    setMatrixDraft(draft);
  };

  const toggleCell = (screenKey: string, field: keyof DraftRow) => {
    setMatrixDraft((prev) => ({ ...prev, [screenKey]: { ...prev[screenKey], [field]: !prev[screenKey][field] } }));
  };
  const toggleFullRow = (screenKey: string) => {
    setMatrixDraft((prev) => {
      const row = prev[screenKey];
      const allOn = row.canCreate && row.canUpdate && row.canDelete;
      return { ...prev, [screenKey]: { canCreate: !allOn, canUpdate: !allOn, canDelete: !allOn } };
    });
  };

  const saveMatrix = async () => {
    if (!matrixGroup) return;
    setMatrixSaving(true);
    try {
      const permissions = screens
        .map((s) => ({ screenKey: s.key, ...matrixDraft[s.key] }))
        .filter((p) => p.canCreate || p.canUpdate || p.canDelete);
      await api.put(`/permission-groups/${matrixGroup.id}/permissions`, { permissions });
      message.success('Đã lưu ma trận quyền — nhân viên trong nhóm cần đăng nhập lại để áp dụng');
      setMatrixGroup(null);
      fetchGroups();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Không lưu được ma trận quyền');
    } finally {
      setMatrixSaving(false);
    }
  };

  const groupColumns = [
    { title: 'Tên nhóm', dataIndex: 'name', key: 'name', width: 220, ellipsis: true, render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', width: 280, ellipsis: true, render: (v?: string) => v || '-' },
    { title: 'Số nhân viên', key: 'userCount', width: 120, align: 'right' as const, render: (_: unknown, g: PermissionGroup) => g._count?.users ?? 0 },
    {
      title: 'Thao tác', key: 'action', width: 260,
      render: (_: unknown, g: PermissionGroup) => (
        <Space wrap size={4}>
          <Button size="small" icon={<SettingOutlined />} onClick={() => openMatrix(g)}>Ma trận quyền</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditGroup(g)}>Sửa</Button>
          <Popconfirm
            title="Xoá nhóm quyền này?"
            description={g._count?.users ? `Còn ${g._count.users} nhân viên thuộc nhóm — chuyển nhóm khác trước.` : 'Không thể hoàn tác.'}
            okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteGroup(g)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} disabled={!!g._count?.users}>Xoá</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
                <TeamOutlined style={{ marginRight: 6 }} />
                Nhóm quyền
              </span>
            ),
            children: (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>Nhóm quyền</span>
                    <span style={{ marginLeft: 8, color: 'var(--on-surface-variant)', fontSize: 13 }}>
                      — Admin luôn toàn quyền. Nhân viên chỉ Thêm/Sửa/Xóa được ở màn nào nhóm của họ được cấp.
                    </span>
                  </div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddGroup}>Tạo nhóm quyền</Button>
                </div>
                <Table columns={groupColumns} dataSource={groups} rowKey="id" loading={groupsLoading} pagination={false} />
              </Card>
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
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]} initialValue="staff">
            <Select placeholder="Chọn vai trò">
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="staff">Nhân viên</Select.Option>
            </Select>
          </Form.Item>
          {watchedRole !== 'admin' && (
            <Form.Item name="permissionGroupId" label="Nhóm quyền" tooltip="Quyết định nhân viên này Thêm/Sửa/Xóa được ở những màn nào">
              <Select placeholder="Chưa gán nhóm quyền" allowClear>
                {groups.map((g) => <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
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

      {/* Add / Edit permission group modal */}
      <Modal
        title={editingGroup ? 'Sửa nhóm quyền' : 'Tạo nhóm quyền'}
        open={groupModal}
        onCancel={() => setGroupModal(false)}
        onOk={() => groupForm.submit()}
        okText={editingGroup ? 'Cập nhật' : 'Tạo'}
        cancelText="Hủy"
      >
        <Form form={groupForm} layout="vertical" onFinish={handleGroupSubmit}>
          <Form.Item name="name" label="Tên nhóm quyền" rules={[{ required: true, message: 'Vui lòng nhập tên nhóm' }]}>
            <Input placeholder="VD: Nhân viên trực ca, Kế toán..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Permission matrix modal */}
      <Modal
        title={`Ma trận quyền — ${matrixGroup?.name || ''}`}
        open={!!matrixGroup}
        onCancel={() => setMatrixGroup(null)}
        onOk={saveMatrix}
        confirmLoading={matrixSaving}
        okText="Lưu" cancelText="Hủy"
        width={640}
      >
        <p style={{ color: 'var(--on-surface-variant)', fontSize: 13, marginBottom: 12 }}>
          Tick "Toàn quyền" để bật nhanh cả Thêm/Sửa/Xóa cho một màn. Màn nào không tick gì thì nhóm này
          không thao tác được (vẫn xem được — Xem không nằm trong ma trận, luôn mở cho mọi nhân viên).
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-container-low)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Chức năng</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Thêm</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Sửa</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 70 }}>Xóa</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 90 }}>Toàn quyền</th>
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((group) => {
              const rows = screens.filter((s) => s.group === group);
              if (!rows.length) return null;
              return (
                <React.Fragment key={group}>
                  <tr>
                    <td colSpan={5} style={{ padding: '6px 10px', background: 'var(--surface-container-lowest)', fontWeight: 700, color: 'var(--primary)', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                      {group}
                    </td>
                  </tr>
                  {rows.map((s, i) => {
                    const row = matrixDraft[s.key] || { canCreate: false, canUpdate: false, canDelete: false };
                    const allOn = row.canCreate && row.canUpdate && row.canDelete;
                    return (
                      <tr key={s.key} style={{ background: i % 2 === 0 ? 'var(--surface-container-lowest)' : 'var(--surface-container-low)', borderBottom: '1px solid var(--card-hairline)' }}>
                        <td style={{ padding: '8px 10px' }}>{s.label}</td>
                        <td style={{ textAlign: 'center' }}><Checkbox checked={row.canCreate} onChange={() => toggleCell(s.key, 'canCreate')} /></td>
                        <td style={{ textAlign: 'center' }}><Checkbox checked={row.canUpdate} onChange={() => toggleCell(s.key, 'canUpdate')} /></td>
                        <td style={{ textAlign: 'center' }}><Checkbox checked={row.canDelete} onChange={() => toggleCell(s.key, 'canDelete')} /></td>
                        <td style={{ textAlign: 'center' }}>
                          <Tooltip title="Bật/tắt nhanh cả 3 quyền">
                            <Checkbox checked={allOn} onChange={() => toggleFullRow(s.key)} />
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Modal>
    </div>
  );
};

export default Users;
