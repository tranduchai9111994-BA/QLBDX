import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, InputNumber, DatePicker, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import dayjs from 'dayjs';
import api from '../api/axios';
import { VehicleType, VehicleTypeForm, ScheduleRateChangeForm, RateHistoryEntry } from '../types';
import { useLanguage } from '../context/LanguageContext';
import PermissionGate from '../components/PermissionGate';
import FilterBar from '../components/FilterBar';
import { defaultPagination } from '../utils/tablePagination';

const VehicleTypes: React.FC = () => {
  const { t } = useLanguage();
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<VehicleType | null>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm<VehicleTypeForm>();
  const [submitting, setSubmitting] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<VehicleType | null>(null);
  const [scheduleForm] = Form.useForm<ScheduleRateChangeForm>();
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<VehicleType | null>(null);
  const [historyData, setHistoryData] = useState<RateHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<VehicleType[]>('/vehicle-types');
      setTypes(res.data);
    } catch (err) {
      message.error('Không tải được danh sách loại xe');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (values: VehicleTypeForm) => {
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/vehicle-types/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/vehicle-types', values);
        message.success('Thêm loại xe thành công');
      }
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await api.delete(`/vehicle-types/${id}`);
      message.success(res.data.message);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: VehicleType) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      hourlyRate: record.hourlyRate,
      dailyRate: record.dailyRate,
      monthlyRate: record.monthlyRate,
    });
    setModal(true);
  };

  const openScheduleModal = (record: VehicleType) => {
    setScheduleTarget(record);
    scheduleForm.setFieldsValue({
      hourlyRate: record.hourlyRate,
      dailyRate: record.dailyRate,
      monthlyRate: record.monthlyRate,
      effectiveFrom: dayjs(),
    });
  };

  const handleScheduleSubmit = async (values: ScheduleRateChangeForm) => {
    if (!scheduleTarget) return;
    setScheduleSubmitting(true);
    try {
      const res = await api.post(`/vehicle-types/${scheduleTarget.id}/rate-changes`, {
        hourlyRate: values.hourlyRate,
        dailyRate: values.dailyRate,
        monthlyRate: values.monthlyRate,
        effectiveFrom: dayjs(values.effectiveFrom).toISOString(),
      });
      message.success(res.data.message);
      setScheduleTarget(null);
      scheduleForm.resetFields();
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const openHistoryModal = async (record: VehicleType) => {
    setHistoryTarget(record);
    setHistoryLoading(true);
    try {
      const res = await api.get<RateHistoryEntry[]>(`/vehicle-types/${record.id}/rate-changes`);
      setHistoryData(res.data);
    } catch {
      message.error('Không tải được lịch sử giá');
    } finally {
      setHistoryLoading(false);
    }
  };

  const columns = [
    { title: t('colVehicleType'), dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
    { title: t('fieldNote'), dataIndex: 'description', key: 'description', width: 260, ellipsis: true, render: (v?: string) => v || '-' },
    {
      title: t('colHourlyRate'), dataIndex: 'hourlyRate', key: 'hourlyRate', width: 130, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
    },
    {
      title: t('colDailyRate'), dataIndex: 'dailyRate', key: 'dailyRate', width: 130, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
    },
    {
      title: 'Giá/tháng (đ)', dataIndex: 'monthlyRate', key: 'monthlyRate', width: 140, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
    },
    {
      title: 'Thao tác', key: 'action', width: 320, render: (_: any, r: VehicleType) => (
        <Space wrap>
          <Button icon={<HistoryOutlined />} onClick={() => openHistoryModal(r)} size="small">Lịch sử giá</Button>
          <PermissionGate adminOnly fallback={<Tag color="default">Chỉ quản trị được sửa</Tag>}>
            <Button icon={<ClockCircleOutlined />} onClick={() => openScheduleModal(r)} size="small">Đặt lịch đổi giá</Button>
            <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
            <Popconfirm title="Xác nhận xóa loại xe này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
              <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
            </Popconfirm>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  const filteredTypes = types.filter((type) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [
      type.name,
      type.description,
      String(type.hourlyRate),
      String(type.dailyRate),
      String(type.monthlyRate),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  return (
    <div>
      <h2 className="page-title">{t('pageVehicleTypes')}</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <PermissionGate adminOnly>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
            Thêm loại xe
          </Button>
        </PermissionGate>
      </div>
      <FilterBar onReset={() => setSearch('')}>
        <Input.Search
          placeholder="Tìm tên loại, mô tả, mức giá..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 320 }}
        />
      </FilterBar>
      <Card>
        <Table columns={columns} dataSource={filteredTypes} rowKey="id" loading={loading} pagination={defaultPagination({ pageSize: 10 })} />
      </Card>

      <Modal
        title={editing ? 'Sửa loại xe' : 'Thêm loại xe'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        okButtonProps={{ loading: submitting }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Tên loại xe" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input />
          </Form.Item>
          <Form.Item name="hourlyRate" label="Giá theo lượt (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="dailyRate" label="Giá theo ngày (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="monthlyRate" label="Giá theo tháng (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Đặt lịch đổi giá — ${scheduleTarget?.name || ''}`}
        open={!!scheduleTarget}
        onCancel={() => { setScheduleTarget(null); scheduleForm.resetFields(); }}
        onOk={() => scheduleForm.submit()}
        okText="Lưu lịch đổi giá"
        cancelText="Hủy"
        okButtonProps={{ loading: scheduleSubmitting }}
      >
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 16 }}>
          Chọn ngày hiệu lực là <b>hôm nay</b> để áp dụng ngay, hoặc chọn ngày trong tương lai để hệ thống
          tự động áp dụng đúng ngày đó. Các lượt xe/gói đã chốt giá trước đó không bị ảnh hưởng.
        </p>
        <Form form={scheduleForm} layout="vertical" onFinish={handleScheduleSubmit}>
          <Form.Item name="hourlyRate" label="Giá theo lượt (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="dailyRate" label="Giá theo ngày (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="monthlyRate" label="Giá theo tháng (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="effectiveFrom" label="Ngày hiệu lực" rules={[{ required: true, message: 'Vui lòng chọn ngày hiệu lực' }]}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Lịch sử giá — ${historyTarget?.name || ''}`}
        open={!!historyTarget}
        onCancel={() => { setHistoryTarget(null); setHistoryData([]); }}
        footer={null}
        width={620}
      >
        <Table
          size="small"
          loading={historyLoading}
          dataSource={historyData}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: 'Trạng thái', key: 'state', width: 110,
              render: (_: any, r: RateHistoryEntry) => dayjs(r.effectiveFrom).isAfter(dayjs())
                ? <Tag color="blue">Sắp áp dụng</Tag>
                : <Tag color="green">Đã áp dụng</Tag>,
            },
            { title: 'Hiệu lực từ', dataIndex: 'effectiveFrom', key: 'effectiveFrom', width: 120, ellipsis: true, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
            {
              title: 'Giá/lượt', dataIndex: 'hourlyRate', key: 'hourlyRate', width: 110, align: 'right' as const,
              render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
            },
            {
              title: 'Giá/ngày', dataIndex: 'dailyRate', key: 'dailyRate', width: 110, align: 'right' as const,
              render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
            },
            { title: 'Người đổi', key: 'changer', width: 140, ellipsis: true, render: (_: any, r: RateHistoryEntry) => r.changer?.fullName || '-' },
          ]}
          locale={{ emptyText: 'Chưa có lịch sử đổi giá — giá hiện tại là giá gốc khi tạo loại xe' }}
        />
      </Modal>
    </div>
  );
};

export default VehicleTypes;
