/**
 * Màn hình BÃI ĐỖ XE — sơ đồ các khu vực và chỗ đỗ, hiển thị chỗ nào trống, chỗ nào đang có xe.
 *
 * Trạng thái chỗ đỗ do luồng xe vào / xe ra tự cập nhật. Quản trị viên sửa tay được, NHƯNG
 * backend chặn mọi thay đổi làm trạng thái LỆCH VỚI THỰC TẾ (parkingSpot.service.ts -> update):
 *   - chỗ đang có xe  -> không cho chuyển sang trạng thái nào khác 'occupied'
 *   - chỗ chưa có xe  -> không cho tự đặt thành 'occupied'
 * Tức là admin chỉ xoay được giữa Trống / Đã đặt / Bảo trì, còn 'occupied' luôn do luồng xe
 * vào-ra quyết định. Nhờ vậy sơ đồ bãi không bao giờ báo trống trong khi đang có xe đỗ.
 *
 * ===========================================================================================
 * MÀN HÌNH QUẢN LÝ HAI THỰC THỂ LỒNG NHAU, đừng nhầm:
 *   KHU VỰC (ParkingZone) - "Khu A", "Khu B"... Một khu chứa nhiều chỗ đỗ.
 *   CHỖ ĐỖ  (ParkingSpot) - "A01", "A02"...    Mỗi chỗ thuộc đúng một khu.
 * Vì thế có ĐÔI state, ĐÔI bộ cột, ĐÔI modal, đặt trong hai tab. Đọc code cứ bám theo tiền tố
 * `zone...` hay `spot...` là biết đang ở nhánh nào.
 *
 * Phần thẻ khu vực ở đầu trang vừa là bảng tóm tắt, vừa là BỘ LỌC: bấm vào thẻ nào thì bảng
 * chỗ đỗ bên dưới lọc theo khu đó.
 * ===========================================================================================
 */
import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Select, Row, Col, Badge, Button, Modal, Form, Input, message, Tabs, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { ParkingSpot, ParkingZone, ParkingZoneForm, ParkingSpotForm, ParkingSpotUpdateForm } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { confirmDanger } from '../utils/confirmDanger';
import { defaultPagination } from '../utils/tablePagination';

// Hai bảng tra "mã trong DB -> chữ tiếng Việt". Khai báo ngoài component để không bị tạo lại
// mỗi lần trang vẽ, và để dùng được ở nhiều chỗ: vẽ bảng, dựng ô lọc (Object.entries), và so
// khớp khi tìm kiếm.
const statusLabels: Record<string, string> = {
  available: 'Trống',
  occupied: 'Đang sử dụng',
  reserved: 'Đã đặt',
  maintenance: 'Bảo trì',
};

const spotTypeLabels: Record<string, string> = {
  standard: 'Tiêu chuẩn',
  vip: 'VIP',
  disabled: 'Người khuyết tật',
};

const ParkingSpots: React.FC = () => {
  /* ══ KHỐI 1 — QUYỀN ═══════════════════════════════════════════════════════════════════
     Trang này tự tra quyền thay vì bọc <PermissionGate> như các trang khác, vì quyền được
     dùng ở nhiều kiểu khác nhau: ẩn nút, ẩn cả cột, và hiện thẻ "Chỉ quản trị được sửa".
     Logic bên trong giống hệt PermissionGate — vẫn là admin đi tắt, còn lại tra ma trận.    */
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';
  const hasPerm = (action: 'create' | 'update' | 'delete') => {
    if (isAdmin) return true;
    const perm = (user?.permissions || []).find((p) => p.screenKey === 'parking-spots');
    return !!perm && (action === 'create' ? perm.canCreate : action === 'update' ? perm.canUpdate : perm.canDelete);
  };
  const canCreate = hasPerm('create');
  const canUpdate = hasPerm('update');
  const canDelete = hasPerm('delete');
  const canManage = canUpdate || canDelete;   // có ít nhất một quyền -> không hiện thẻ "chỉ xem"

  /* ══ KHỐI 2 — STATE ═══════════════════════════════════════════════════════════════════ */
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // `selectedZone` gánh HAI vai: vừa là ô lọc "Khu vực", vừa là thẻ khu đang được bấm sáng ở
  // đầu trang. Dùng chung một state nên hai chỗ luôn khớp nhau, bấm thẻ thì ô lọc cũng đổi theo.
  const [selectedZone, setSelectedZone] = useState<number | null>(null);

  // Mỗi tab một ô tìm kiếm riêng: đang tìm chỗ đỗ rồi chuyển sang tab Khu vực thì từ khoá cũ
  // không được dính sang, vì hai tab tìm trên hai tập dữ liệu khác nhau.
  const [spotSearch, setSpotSearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [spotStatusFilter, setSpotStatusFilter] = useState<string | undefined>();
  const [spotTypeFilter, setSpotTypeFilter] = useState<string | undefined>();

  // Zone modal
  const [zoneModal, setZoneModal] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<ParkingZone | null>(null);
  const [zoneForm] = Form.useForm<ParkingZoneForm>();

  // Spot modal
  const [spotModal, setSpotModal] = useState<boolean>(false);
  const [editingSpot, setEditingSpot] = useState<ParkingSpot | null>(null);
  const [spotForm] = Form.useForm<ParkingSpotForm & ParkingSpotUpdateForm>();
  const [spotSubmitting, setSpotSubmitting] = useState(false);
  const [zoneSubmitting, setZoneSubmitting] = useState(false);

  /* ══ KHỐI 3 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Tải chỗ đỗ + khu vực. Chỉ điều kiện LỌC THEO KHU được gửi cho backend; các ô lọc còn lại
   * (trạng thái, loại chỗ, từ khoá) lọc ngay trên trình duyệt ở KHỐI 6 — số chỗ đỗ của một bãi
   * là cố định và nhỏ, tải hết một lần rồi lọc tại chỗ cho phản hồi tức thì.
   */
  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedZone) params.zoneId = selectedZone;
      const [sRes, zRes] = await Promise.all([
        api.get<ParkingSpot[]>('/parking-spots', { params }),
        api.get<ParkingZone[]>('/parking-zones'),
      ]);
      setSpots(sRes.data);
      setZones(zRes.data);
    } catch (err) {
      message.error('Không tải được dữ liệu bãi đỗ xe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedZone]);

  /* ══ KHỐI 4 — CRUD KHU VỰC ════════════════════════════════════════════════════════════ */

  /** Thêm/Sửa khu vực, phân biệt bằng `editingZone` (null = thêm mới). */
  const handleZoneSubmit = async (values: ParkingZoneForm) => {
    setZoneSubmitting(true);
    try {
      if (editingZone) {
        await api.put(`/parking-zones/${editingZone.id}`, values);
        message.success('Cập nhật khu vực thành công');
      } else {
        await api.post('/parking-zones', values);
        message.success('Thêm khu vực thành công');
      }
      setZoneModal(false);
      zoneForm.resetFields();
      setEditingZone(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setZoneSubmitting(false);
    }
  };

  const handleEditZone = (zone: ParkingZone) => {
    setEditingZone(zone);
    zoneForm.setFieldsValue({ name: zone.name, description: zone.description });
    setZoneModal(true);
  };

  /**
   * Xoá khu vực. Dùng `confirmDanger` (utils/confirmDanger.tsx) thay cho Popconfirm: hộp thoại
   * to hơn, có chỗ ghi rõ hậu quả — xoá cả một khu là việc nặng hơn nhiều so với xoá một dòng.
   */
  const handleDeleteZone = (id: number) => {
    confirmDanger({
      title: 'Xác nhận xóa khu vực',
      content: 'Nếu khu vực còn chỗ đỗ hoặc đã phát sinh lịch sử gửi xe, hệ thống sẽ chặn xóa để bảo toàn dữ liệu.',
      successMessage: 'Xóa khu vực thành công',
      errorFallback: 'Không thể xóa khu vực',
      onConfirm: async () => {
        await api.delete(`/parking-zones/${id}`);
        // Đang lọc theo đúng khu vừa xoá -> phải bỏ lọc, nếu không bảng sẽ lọc theo một id
        // không còn tồn tại và hiện rỗng mãi.
        if (selectedZone === id) setSelectedZone(null);
        fetchData();
      },
    });
  };

  /* ══ KHỐI 5 — CRUD CHỖ ĐỖ ═════════════════════════════════════════════════════════════ */

  /**
   * Thêm/Sửa chỗ đỗ. Khác các trang khác ở chỗ hai nhánh gửi HAI BỘ FIELD KHÁC HẲN NHAU:
   *   THÊM : zoneId + spotNumber + spotType   (chưa có xe nên chưa có trạng thái để đặt)
   *   SỬA  : spotType + status                (KHÔNG cho đổi khu và mã chỗ)
   *
   * Vì sao sửa không cho đổi khu/mã chỗ: mã chỗ đã in trên nền bãi và ghi trong các lượt gửi
   * cũ. Đổi "A01" thành "B05" sẽ làm toàn bộ lịch sử trỏ sai vị trí thật.
   */
  const handleSpotSubmit = async (values: any) => {
    setSpotSubmitting(true);
    try {
      if (editingSpot) {
        await api.put(`/parking-spots/${editingSpot.id}`, {
          spotType: values.spotType,
          status: values.status,
        });
        message.success('Cập nhật chỗ đỗ thành công');
      } else {
        await api.post('/parking-spots', {
          zoneId: values.zoneId,
          spotNumber: values.spotNumber,
          spotType: values.spotType || 'standard',
        });
        message.success('Thêm chỗ đỗ thành công');
      }
      setSpotModal(false);
      spotForm.resetFields();
      setEditingSpot(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSpotSubmitting(false);
    }
  };

  const handleEditSpot = (spot: ParkingSpot) => {
    setEditingSpot(spot);
    spotForm.setFieldsValue({
      zoneId: spot.zoneId,
      spotNumber: spot.spotNumber,
      spotType: spot.spotType,
      status: spot.status,
    });
    setSpotModal(true);
  };

  const handleDeleteSpot = (id: number) => {
    confirmDanger({
      title: 'Xác nhận xóa chỗ đỗ',
      content: 'Nếu chỗ đỗ đang được dùng hoặc đã có lịch sử, hệ thống sẽ chặn xóa.',
      successMessage: 'Xóa chỗ đỗ thành công',
      errorFallback: 'Không thể xóa chỗ đỗ',
      onConfirm: async () => {
        await api.delete(`/parking-spots/${id}`);
        fetchData();
      },
    });
  };

  /* ══ KHỐI 6 — CỘT BẢNG ════════════════════════════════════════════════════════════════ */
  const spotColumns = [
    { title: 'Mã chỗ', dataIndex: 'spotNumber', key: 'spotNumber', width: 100, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Khu vực', key: 'zoneName', width: 160, ellipsis: true, render: (_: any, r: ParkingSpot) => r.zone?.name || '-' },
    { title: 'Loại', dataIndex: 'spotType', key: 'spotType', width: 150, render: (t: string) => t === 'vip' ? <Tag color="gold">VIP</Tag> : t === 'disabled' ? <Tag color="blue">Người khuyết tật</Tag> : <Tag>Tiêu chuẩn</Tag> },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 150,
      // Ba màu cho bốn trạng thái: trống = xanh, có xe = đỏ, còn lại (đã đặt/bảo trì) = vàng.
      // `|| t` ở cuối là lưới an toàn: DB có giá trị lạ thì hiện nguyên mã thay vì để trống.
      render: (t: string) => <Badge status={t === 'available' ? 'success' : t === 'occupied' ? 'error' : 'warning'} text={statusLabels[t] || t} />,
    },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: ParkingSpot) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {canUpdate && <Button icon={<EditOutlined />} onClick={() => handleEditSpot(r)} size="small">Sửa</Button>}
          {canDelete && <Button icon={<DeleteOutlined />} onClick={() => handleDeleteSpot(r.id)} size="small" danger>Xóa</Button>}
          {!canManage && <Tag color="default">Chỉ quản trị được sửa</Tag>}
        </div>
      ),
    },
  ];

  const zoneColumns = [
    { title: 'Tên khu vực', dataIndex: 'name', key: 'name', width: 180, ellipsis: true, render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', width: 260, ellipsis: true, render: (t?: string) => t || '-' },
    { title: 'Tổng chỗ', dataIndex: 'totalSpots', key: 'totalSpots', width: 100, ellipsis: true },
    { title: 'Trống', dataIndex: 'availableSpots', key: 'availableSpots', width: 100, render: (v: number) => <Tag className="chip-available">{v}</Tag> },
    { title: 'Đang dùng', dataIndex: 'occupiedSpots', key: 'occupiedSpots', width: 110, render: (v: number) => <Tag className="chip-occupied">{v}</Tag> },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: ParkingZone) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {canUpdate && <Button icon={<EditOutlined />} onClick={() => handleEditZone(r)} size="small">Sửa</Button>}
          {canDelete && <Button icon={<DeleteOutlined />} onClick={() => handleDeleteZone(r.id)} size="small" danger>Xóa</Button>}
          {!canManage && <Tag color="default">Chỉ quản trị được sửa</Tag>}
        </div>
      ),
    },
  ];

  /* ══ KHỐI 7 — LỌC TRÊN TRÌNH DUYỆT ════════════════════════════════════════════════════
     Ba điều kiện nối bằng VÀ: trạng thái, loại chỗ, rồi mới tới từ khoá. Trả về false sớm cho
     hai điều kiện đầu để không phải ghép chuỗi tìm kiếm một cách vô ích.                      */
  const filteredSpotRows = spots.filter((spot) => {
    if (spotStatusFilter && spot.status !== spotStatusFilter) return false;
    if (spotTypeFilter && spot.spotType !== spotTypeFilter) return false;
    const keyword = spotSearch.trim().toLowerCase();
    if (!keyword) return true;
    // Tìm cả trên NHÃN TIẾNG VIỆT (qua hai bảng tra ở đầu file), không chỉ trên mã trong DB.
    // Nhờ vậy gõ "bảo trì" là ra, thay vì bắt người dùng nhớ mã 'maintenance'.
    return [spot.spotNumber, spot.zone?.name, spotTypeLabels[spot.spotType], statusLabels[spot.status]]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  const filteredZones = zones.filter((zone) => {
    const keyword = zoneSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [zone.name, zone.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  return (
    <div>
      <h2 className="page-title">{t('pageParkingSpots')}</h2>

      {/* ══ KHỐI 8 — THẺ TÓM TẮT TỪNG KHU ═══════════════════════════════════════════════
          Vừa là bảng tóm tắt (còn trống bao nhiêu / tổng bao nhiêu), vừa là BỘ LỌC bấm được. */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {filteredZones.map((z) => (
          <Col xs={24} sm={12} lg={6} key={z.id}>
            <Card className={`zone-card${z.id === selectedZone ? ' zone-selected' : ''}`}
              // Bấm lần nữa vào thẻ ĐANG chọn thì bỏ chọn (đặt lại null). Không có nhánh đó thì
              // người dùng chọn nhầm khu sẽ không biết cách quay lại xem tất cả.
              onClick={() => setSelectedZone(z.id === selectedZone ? null : z.id)}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{z.name}</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{z.availableSpots}<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--on-surface-variant)' }}> / {z.totalSpots}</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', margin: '4px 0 12px' }}>{z.description}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tag className="chip-available">{z.availableSpots} trống</Tag>
                <Tag className="chip-occupied">{z.occupiedSpots} đang dùng</Tag>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        {/* Hai tab cho hai thực thể. Mặc định mở tab "Chỗ đỗ xe" vì đó là thứ nhân viên xem
            hằng ngày; tab "Khu vực" chỉ động đến khi mở rộng bãi. */}
        <Tabs defaultActiveKey="spots" items={[
          {
            key: 'spots',
            label: 'Chỗ đỗ xe',
            children: (
              <>
                <div className="toolbar">
                  <Space wrap>
                    <Input.Search
                      placeholder="Tìm mã chỗ, khu, trạng thái..."
                      value={spotSearch}
                      onChange={(e) => setSpotSearch(e.target.value)}
                      allowClear
                      style={{ width: 280 }}
                    />
                    <Select placeholder="Lọc theo khu vực" style={{ width: 220 }} value={selectedZone} onChange={setSelectedZone} allowClear>
                      {zones.map((z) => <Select.Option key={z.id} value={z.id}>{z.name}</Select.Option>)}
                    </Select>
                    <Select
                      placeholder="Lọc theo trạng thái"
                      style={{ width: 180 }}
                      value={spotStatusFilter}
                      onChange={setSpotStatusFilter}
                      allowClear
                      options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
                    />
                    <Select
                      placeholder="Lọc theo loại chỗ"
                      style={{ width: 180 }}
                      value={spotTypeFilter}
                      onChange={setSpotTypeFilter}
                      allowClear
                      options={Object.entries(spotTypeLabels).map(([value, label]) => ({ value, label }))}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => { setSpotSearch(''); setSelectedZone(null); setSpotStatusFilter(undefined); setSpotTypeFilter(undefined); }}>
                      Xóa bộ lọc
                    </Button>
                  </Space>
                  <div className="toolbar-right">
                    {/* Đang lọc theo một khu thì điền sẵn khu đó vào form — thêm nhiều chỗ
                        liên tiếp cho cùng một khu là việc hay làm nhất. */}
                    {canCreate && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingSpot(null); spotForm.resetFields(); if (selectedZone) spotForm.setFieldsValue({ zoneId: selectedZone }); setSpotModal(true); }}>
                        Thêm chỗ đỗ
                      </Button>
                    )}
                  </div>
                </div>
                <Table columns={spotColumns} dataSource={filteredSpotRows} rowKey="id" loading={loading} pagination={defaultPagination({ pageSize: 20 })} />
              </>
            ),
          },
          {
            key: 'zones',
            label: 'Khu vực',
            children: (
              <>
                <div className="toolbar">
                  <Space wrap>
                    <Input.Search
                      placeholder="Tìm tên khu vực, mô tả..."
                      value={zoneSearch}
                      onChange={(e) => setZoneSearch(e.target.value)}
                      allowClear
                      style={{ width: 280 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => setZoneSearch('')}>Xóa bộ lọc</Button>
                  </Space>
                  <div className="toolbar-right">
                    {canCreate && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingZone(null); zoneForm.resetFields(); setZoneModal(true); }}>
                        Thêm khu vực
                      </Button>
                    )}
                  </div>
                </div>
                <Table columns={zoneColumns} dataSource={filteredZones} rowKey="id" loading={loading} />
              </>
            ),
          },
        ]} />
      </Card>

      {/* Zone Modal */}
      <Modal
        title={editingZone ? 'Sửa khu vực' : 'Thêm khu vực'}
        open={zoneModal}
        onCancel={() => { setZoneModal(false); setEditingZone(null); zoneForm.resetFields(); }}
        onOk={() => zoneForm.submit()}
        okText={editingZone ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        okButtonProps={{ loading: zoneSubmitting }}
      >
        <Form form={zoneForm} layout="vertical" onFinish={handleZoneSubmit}>
          <Form.Item name="name" label="Tên khu vực" rules={[{ required: true, message: 'Vui lòng nhập tên khu vực' }]}>
            <Input placeholder="VD: Khu A" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input placeholder="VD: Khu vực xe máy" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Spot Modal */}
      <Modal
        title={editingSpot ? 'Sửa chỗ đỗ' : 'Thêm chỗ đỗ'}
        open={spotModal}
        onCancel={() => { setSpotModal(false); setEditingSpot(null); spotForm.resetFields(); }}
        onOk={() => spotForm.submit()}
        okText={editingSpot ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        okButtonProps={{ loading: spotSubmitting }}
      >
        <Form form={spotForm} layout="vertical" onFinish={handleSpotSubmit}>
          {/* Hai ô này CHỈ hiện khi THÊM mới. Lúc sửa thì ẩn đi, khớp với việc handleSpotSubmit
              không gửi zoneId/spotNumber ở nhánh sửa — giao diện và dữ liệu gửi đi nói cùng
              một chuyện, không để người dùng sửa một ô rồi phát hiện nó không có tác dụng. */}
          {!editingSpot && (
            <>
              <Form.Item name="zoneId" label="Khu vực" rules={[{ required: true, message: 'Vui lòng chọn khu vực' }]}>
                <Select placeholder="Chọn khu vực">
                  {zones.map((z) => <Select.Option key={z.id} value={z.id}>{z.name}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="spotNumber" label="Mã chỗ đỗ" rules={[{ required: true, message: 'Vui lòng nhập mã chỗ đỗ' }]}>
                <Input placeholder="VD: A01, B02" />
              </Form.Item>
            </>
          )}
          <Form.Item name="spotType" label="Loại chỗ đỗ">
            <Select placeholder="Chọn loại">
              <Select.Option value="standard">Tiêu chuẩn</Select.Option>
              <Select.Option value="vip">VIP</Select.Option>
              <Select.Option value="disabled">Người khuyết tật</Select.Option>
            </Select>
          </Form.Item>
          {/* Ngược lại, ô Trạng thái chỉ hiện khi SỬA. Chỗ mới thêm mặc định là 'available',
              chưa có gì để chọn. Lưu ý backend vẫn chặn các giá trị làm lệch thực tế — xem
              phần đầu file. */}
          {editingSpot && (
            <Form.Item name="status" label="Trạng thái">
              <Select placeholder="Chọn trạng thái">
                <Select.Option value="available">Trống</Select.Option>
                <Select.Option value="occupied">Đang sử dụng</Select.Option>
                <Select.Option value="reserved">Đã đặt</Select.Option>
                <Select.Option value="maintenance">Bảo trì</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ParkingSpots;
