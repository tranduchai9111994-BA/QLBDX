/**
 * Màn hình NGƯỜI DÙNG & PHÂN QUYỀN (chỉ admin).
 *
 * Hai phần: quản lý tài khoản, và cấu hình nhóm quyền — ma trận "màn hình x hành động
 * (xem/thêm/sửa/xoá)" gán cho nhân viên. Nhóm quyền cấu hình ở đây chính là dữ liệu mà backend
 * tra cứu để chặn API (middlewares/requirePermission.ts).
 *
 * ===========================================================================================
 * ĐÂY LÀ NƠI "CẤP QUYỀN", CÒN NƠI "CHẶN QUYỀN" Ở BACKEND.
 *
 * Ma trận tick trong modal cuối file được lưu xuống bảng GroupPermission. Mỗi lần có request,
 * middlewares/requirePermission.ts tra đúng bảng đó theo cặp (nhóm quyền, màn hình) rồi cho
 * qua hay từ chối. Tức là màn hình này KHÔNG tự bảo mật gì — nó chỉ ghi dữ liệu mà lớp bảo
 * mật thật sự đọc.
 *
 * Ba khái niệm dễ nhầm:
 *   VAI TRÒ (role)       - 'admin' hoặc 'staff'. Admin luôn toàn quyền, bỏ qua mọi ma trận.
 *   NHÓM QUYỀN (group)   - "Nhân viên trực ca", "Kế toán"... Chỉ áp cho staff.
 *   MA TRẬN (permission) - trong một nhóm: màn hình nào được Thêm/Sửa/Xoá.
 *
 * Hai tab:
 *   Tab 1 "Danh sách người dùng" - tài khoản, và gán mỗi tài khoản vào một nhóm quyền
 *   Tab 2 "Nhóm quyền"           - tạo nhóm, và mở modal ma trận để tick quyền cho nhóm đó
 * ===========================================================================================
 */
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

// Thứ tự các nhóm chức năng hiện trong modal ma trận. Khai báo cứng ở đây (thay vì sắp theo
// bảng chữ cái) để các màn hình liên quan nhau nằm cạnh nhau — người cấp quyền nhìn theo mạch
// công việc chứ không theo tên.
const GROUP_ORDER = ['Hạ tầng', 'Nghiệp vụ', 'Danh mục', 'Quản trị'];

/** Một dòng trong BẢN NHÁP ma trận — trạng thái đang tick, chưa lưu xuống server. */
type DraftRow = { canCreate: boolean; canUpdate: boolean; canDelete: boolean };

const Users: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  // `currentUser` = người đang đăng nhập. Dùng để CHẶN TỰ XOÁ / TỰ SỬA chính mình (xem cột
  // Thao tác bên dưới) — admin duy nhất tự khoá tài khoản là không ai vào quản trị được nữa.
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
  // Theo dõi ô "Vai trò" đang chọn để ẩn/hiện ô "Nhóm quyền" ngay lập tức. Form.useWatch làm
  // component vẽ lại mỗi khi field đó đổi — đọc bằng form.getFieldValue() thì KHÔNG kích hoạt
  // vẽ lại, và ô Nhóm quyền sẽ không biến mất khi người dùng chọn Admin.
  const watchedRole = Form.useWatch('role', form);

  /* ── Permission groups state ─────────────────────────────────── */
  const [screens, setScreens] = useState<ScreenDef[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [groupForm] = Form.useForm<{ name: string; description?: string }>();

  // --- Modal ma trận quyền ---
  // `matrixGroup` vừa là cờ mở modal vừa là nhóm đang chỉnh.
  // `matrixDraft` là BẢN NHÁP: mọi thao tác tick chỉ sửa bản nháp này, chỉ khi bấm "Lưu" mới
  // gửi lên server. Nhờ vậy người dùng tick nhầm thì bấm Huỷ là xong, và cũng không gửi hàng
  // chục request cho hàng chục lần tick.
  const [matrixGroup, setMatrixGroup] = useState<PermissionGroup | null>(null);
  const [matrixDraft, setMatrixDraft] = useState<Record<string, DraftRow>>({});
  const [matrixSaving, setMatrixSaving] = useState(false);

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  // useCallback: giữ cho hàm không bị tạo mới mỗi lần vẽ. Cần thiết vì hàm này nằm trong mảng
  // phụ thuộc của useEffect bên dưới — không có useCallback thì useEffect chạy lại vô tận.
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

  /**
   * Tải danh sách nhóm quyền VÀ danh sách màn hình.
   *
   * `/permission-groups/screens` trả về danh mục màn hình có thể phân quyền — do BACKEND định
   * nghĩa, không viết cứng ở frontend. Nhờ vậy thêm một màn hình mới vào hệ thống thì modal
   * ma trận tự có thêm dòng, không phải sửa file này. Và quan trọng hơn: danh sách khoá màn
   * hình ở frontend luôn khớp với khoá mà requirePermission dùng để tra ở backend.
   */
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

  /* ══ KHỐI 3 — CRUD NGƯỜI DÙNG ═════════════════════════════════════════════════════════ */

  /** Thêm/Sửa tài khoản. */
  const handleSubmit = async (values: UserForm) => {
    try {
      // Chọn vai trò Admin -> XOÁ nhóm quyền (đặt null). Admin đã toàn quyền nên gán nhóm là
      // thừa và gây hiểu nhầm; tệ hơn là nếu sau này hạ vai trò xuống staff thì tài khoản đó
      // lặng lẽ thừa hưởng nhóm quyền cũ mà không ai để ý.
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
    // `password: undefined` — cố ý để TRỐNG ô mật khẩu khi sửa. Không bao giờ đổ mật khẩu cũ
    // vào form được, vì DB chỉ lưu chuỗi băm bcrypt, không có mật khẩu gốc để mà đổ.
    // Để trống nghĩa là "không đổi mật khẩu" (xem placeholder của ô ở cuối file).
    form.setFieldsValue({ ...record, password: undefined, permissionGroupId: record.permissionGroupId ?? undefined });
    setModal(true);
  };

  /**
   * Xoá tài khoản. Backend tự quyết định xoá hẳn hay chỉ ngừng hoạt động: tài khoản đã từng
   * thu tiền / ghi nhận xe vào thì các bản ghi đó trỏ tới nó, xoá cứng sẽ làm lịch sử mất tên
   * người thực hiện.
   */
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

  /* ══ KHỐI 4 — LỌC TRÊN TRÌNH DUYỆT ════════════════════════════════════════════════════
     Nối ba .filter() liên tiếp thay vì một hàm nhiều điều kiện: mỗi dòng là một tiêu chí, đọc
     tới đâu hiểu tới đó. Số tài khoản trong hệ thống rất ít nên chi phí duyệt ba lượt không
     đáng kể.                                                                                 */
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
          {/* Khoá hai nút với CHÍNH tài khoản đang đăng nhập. Chống tự bắn vào chân mình: hạ
              vai trò hoặc khoá tài khoản của chính mình là mất quyền quản trị ngay lập tức, và
              nếu đó là admin duy nhất thì không còn ai vào sửa lại được. Muốn sửa hồ sơ của
              mình thì dùng màn hình Thông tin cá nhân. */}
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small" disabled={r.id === currentUser?.id}>{t('btnEdit')}</Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger disabled={r.id === currentUser?.id}>{t('btnDelete')}</Button>
        </Space>
      ),
    },
  ];

  /* ══ KHỐI 5 — CRUD NHÓM QUYỀN ═════════════════════════════════════════════════════════ */
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

  /* ══ KHỐI 6 — MA TRẬN QUYỀN ═══════════════════════════════════════════════════════════
     Phần đáng đọc kỹ nhất của file. Ba thao tác: dựng bản nháp -> tick -> lưu.               */

  /**
   * Mở modal và DỰNG BẢN NHÁP từ dữ liệu đã lưu.
   *
   * Duyệt theo `screens` (mọi màn hình có thể phân quyền) chứ không theo `g.permissions`
   * (những dòng đã lưu): nhóm mới tạo chưa có dòng nào, nhưng modal vẫn phải hiện đủ mọi màn
   * hình để tick. Màn nào chưa có dòng thì mặc định tất cả false — đúng nguyên tắc TỪ CHỐI
   * MẶC ĐỊNH mà backend áp dụng.
   */
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

  /**
   * Bật/tắt một ô tick.
   *
   * Hai dấu `...` là bắt buộc: tạo object MỚI cho cả bản nháp và cho dòng bị đổi, thay vì sửa
   * thẳng object cũ. React so sánh theo tham chiếu — sửa tại chỗ thì tham chiếu không đổi,
   * React tưởng không có gì mới và ô tick sẽ không nhúc nhích trên màn hình.
   */
  const toggleCell = (screenKey: string, field: keyof DraftRow) => {
    setMatrixDraft((prev) => ({ ...prev, [screenKey]: { ...prev[screenKey], [field]: !prev[screenKey][field] } }));
  };

  /** Ô "Toàn quyền": đang bật đủ ba thì tắt hết, ngược lại bật hết. Lối tắt cho trường hợp
   *  hay gặp nhất là cấp trọn quyền một màn hình. */
  const toggleFullRow = (screenKey: string) => {
    setMatrixDraft((prev) => {
      const row = prev[screenKey];
      const allOn = row.canCreate && row.canUpdate && row.canDelete;
      return { ...prev, [screenKey]: { canCreate: !allOn, canUpdate: !allOn, canDelete: !allOn } };
    });
  };

  /**
   * Lưu bản nháp xuống server.
   *
   * LƯU Ý QUAN TRỌNG ở dòng .filter(): chỉ gửi những màn hình có ÍT NHẤT MỘT quyền được tick.
   * Màn hình không tick gì thì KHÔNG có dòng nào trong bảng GroupPermission, và theo nguyên
   * tắc từ chối mặc định thì nhân viên trong nhóm sẽ không thao tác được ở màn đó.
   *
   * Hệ quả cần biết khi đọc code (và khác với câu chú thích hiện trên modal): vì màn hình
   * "cấu hình được" cần có dòng quyền thì mới hiện trong menu (MainLayout.canSee) và mới vào
   * được bằng URL (App.tsx -> PermissionRoute), nên không tick gì đồng nghĩa với việc nhân
   * viên cũng KHÔNG THẤY màn hình đó.
   */
  const saveMatrix = async () => {
    if (!matrixGroup) return;
    setMatrixSaving(true);
    try {
      const permissions = screens
        .map((s) => ({ screenKey: s.key, ...matrixDraft[s.key] }))
        .filter((p) => p.canCreate || p.canUpdate || p.canDelete);
      await api.put(`/permission-groups/${matrixGroup.id}/permissions`, { permissions });
      // Nhắc đăng nhập lại: ma trận quyền được gửi kèm hồ sơ khi gọi /auth/me lúc đăng nhập và
      // giữ trong AuthContext suốt phiên, nên GIAO DIỆN của nhân viên đang mở vẫn là bản cũ.
      // Riêng phần CHẶN API thì có hiệu lực ngay, vì requirePermission tra thẳng DB mỗi request.
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
            {/* Còn nhân viên thuộc nhóm thì khoá nút xoá: xoá nhóm sẽ để lại các tài khoản
                không thuộc nhóm nào, và họ mất sạch quyền mà không hiểu vì sao. */}
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
          {/* Tên đăng nhập KHOÁ khi sửa: nó là thứ người dùng dùng để đăng nhập và cũng là thứ
              được ghi vào nhật ký hoạt động. Đổi đi thì các dòng nhật ký cũ không còn đối chiếu
              được với ai. */}
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
          {/* Ô "Nhóm quyền" chỉ hiện với vai trò nhân viên — khớp với việc handleSubmit đặt
              permissionGroupId = null cho admin. Giao diện và dữ liệu gửi đi nói cùng một chuyện. */}
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
          {/* `required: !editing` — bắt buộc khi TẠO MỚI, không bắt buộc khi SỬA. Để trống lúc
              sửa nghĩa là giữ nguyên mật khẩu cũ; backend chỉ băm và ghi đè khi có gửi lên. */}
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
            {/* Duyệt theo GROUP_ORDER (thứ tự cố định) rồi mới lọc màn hình thuộc nhóm đó —
                cách này giữ đúng thứ tự mong muốn, khác với việc gom nhóm từ dữ liệu rồi sắp
                xếp sau. Nhóm không có màn hình nào thì bỏ qua, không vẽ tiêu đề trống. */}
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
                        {/* Ô "Toàn quyền" không lưu xuống DB — nó chỉ là kết quả tính từ ba ô
                            bên trái (`allOn`). Lưu thêm một cột nữa sẽ tạo ra khả năng dữ liệu
                            tự mâu thuẫn với chính nó. */}
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
