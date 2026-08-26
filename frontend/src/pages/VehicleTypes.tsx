import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, InputNumber, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { VehicleType, VehicleTypeForm } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const VehicleTypes: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const canManage = user?.role === 'admin';
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<VehicleType | null>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm<VehicleTypeForm>();
  const [submitting, setSubmitting] = useState(false);

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

  const columns = [
    { title: t('colVehicleType'), dataIndex: 'name', key: 'name' },
    { title: t('fieldNote'), dataIndex: 'description', key: 'description', render: (v?: string) => v || '-' },
    { title: t('colHourlyRate'), dataIndex: 'hourlyRate', key: 'hourlyRate', render: (v: number) => Number(v).toLocaleString() + 'đ' },
    { title: t('colDailyRate'), dataIndex: 'dailyRate', key: 'dailyRate', render: (v: number) => Number(v).toLocaleString() + 'đ' },
    { title: 'Giá/tháng (đ)', dataIndex: 'monthlyRate', key: 'monthlyRate', render: (v: number) => Number(v).toLocaleString() + 'đ' },
    {
      title: 'Thao tác', key: 'action', render: (_: any, r: VehicleType) => (
        <Space>
          {canManage ? (
            <>
              <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
              <Popconfirm title="Xác nhận xóa loại xe này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
                <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
              </Popconfirm>
            </>
          ) : (
            <Tag color="default">Chỉ quản trị được sửa</Tag>
          )}
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
      <Card>
        <div className="toolbar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm tên loại, mô tả, mức giá..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 320 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => setSearch('')}>Xóa bộ lọc</Button>
          </Space>
          <div className="toolbar-right">
            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
                Thêm loại xe
              </Button>
            )}
          </div>
        </div>
        <Table columns={columns} dataSource={filteredTypes} rowKey="id" loading={loading} />
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
    </div>
  );
};

export default VehicleTypes;
