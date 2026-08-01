import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Select, Row, Col, Badge, Button, Modal, Form, Input, message, Tabs, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { ParkingSpot, ParkingZone, ParkingZoneForm, ParkingSpotForm, ParkingSpotUpdateForm } from '../types';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
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

  // === Zone CRUD ===
  const handleZoneSubmit = async (values: ParkingZoneForm) => {
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
    }
  };

  const handleEditZone = (zone: ParkingZone) => {
    setEditingZone(zone);
    zoneForm.setFieldsValue({ name: zone.name, description: zone.description });
    setZoneModal(true);
  };

  const handleDeleteZone = (id: number) => {
    Modal.confirm({
      title: 'Xác nhận xóa khu vực',
      content: 'Nếu khu vực còn chỗ đỗ hoặc đã phát sinh lịch sử gửi xe, hệ thống sẽ chặn xóa để bảo toàn dữ liệu.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/parking-zones/${id}`);
          message.success('Xóa khu vực thành công');
          if (selectedZone === id) setSelectedZone(null);
          fetchData();
        } catch (err) {
          const error = err as AxiosError<{ message: string }>;
          message.error(error.response?.data?.message || 'Không thể xóa khu vực');
        }
      },
    });
  };

  // === Spot CRUD ===
  const handleSpotSubmit = async (values: any) => {
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
    Modal.confirm({
      title: 'Xác nhận xóa chỗ đỗ',
      content: 'Nếu chỗ đỗ đang được dùng hoặc đã có lịch sử, hệ thống sẽ chặn xóa.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/parking-spots/${id}`);
          message.success('Xóa chỗ đỗ thành công');
          fetchData();
        } catch (err) {
          const error = err as AxiosError<{ message: string }>;
          message.error(error.response?.data?.message || 'Không thể xóa chỗ đỗ');
        }
      },
    });
  };

  const spotColumns = [
    { title: 'Mã chỗ', dataIndex: 'spotNumber', key: 'spotNumber', render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Khu vực', key: 'zoneName', render: (_: any, r: ParkingSpot) => r.zone?.name || '-' },
    { title: 'Loại', dataIndex: 'spotType', key: 'spotType', render: (t: string) => t === 'vip' ? <Tag color="gold">VIP</Tag> : t === 'disabled' ? <Tag color="blue">Người khuyết tật</Tag> : <Tag>Tiêu chuẩn</Tag> },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (t: string) => <Badge status={t === 'available' ? 'success' : t === 'occupied' ? 'error' : 'warning'} text={statusLabels[t] || t} />,
    },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: ParkingSpot) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => handleEditSpot(r)} size="small">Sửa</Button>
              <Button icon={<DeleteOutlined />} onClick={() => handleDeleteSpot(r.id)} size="small" danger>Xóa</Button>
            </>
          ) : (
            <Tag color="default">Chỉ quản trị được sửa</Tag>
          )}
        </div>
      ),
    },
  ];

  const zoneColumns = [
    { title: 'Tên khu vực', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ fontWeight: 500 }}>{t}</span> },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (t?: string) => t || '-' },
    { title: 'Tổng chỗ', dataIndex: 'totalSpots', key: 'totalSpots' },
    { title: 'Trống', dataIndex: 'availableSpots', key: 'availableSpots', render: (v: number) => <Tag className="chip-available">{v}</Tag> },
    { title: 'Đang dùng', dataIndex: 'occupiedSpots', key: 'occupiedSpots', render: (v: number) => <Tag className="chip-occupied">{v}</Tag> },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: ParkingZone) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {canManage ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => handleEditZone(r)} size="small">Sửa</Button>
              <Button icon={<DeleteOutlined />} onClick={() => handleDeleteZone(r.id)} size="small" danger>Xóa</Button>
            </>
          ) : (
            <Tag color="default">Chỉ quản trị được sửa</Tag>
          )}
        </div>
      ),
    },
  ];

  const filteredSpotRows = spots.filter((spot) => {
    if (spotStatusFilter && spot.status !== spotStatusFilter) return false;
    if (spotTypeFilter && spot.spotType !== spotTypeFilter) return false;
    const keyword = spotSearch.trim().toLowerCase();
    if (!keyword) return true;
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
      <h2 className="page-title">Quản lý bãi đỗ xe</h2>

      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        {filteredZones.map((z) => (
          <Col xs={24} sm={12} lg={6} key={z.id}>
            <Card className={`zone-card${z.id === selectedZone ? ' zone-selected' : ''}`}
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
                    {canManage && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingSpot(null); spotForm.resetFields(); if (selectedZone) spotForm.setFieldsValue({ zoneId: selectedZone }); setSpotModal(true); }}>
                        Thêm chỗ đỗ
                      </Button>
                    )}
                  </div>
                </div>
                <Table columns={spotColumns} dataSource={filteredSpotRows} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
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
                    {canManage && (
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
      >
        <Form form={spotForm} layout="vertical" onFinish={handleSpotSubmit}>
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
