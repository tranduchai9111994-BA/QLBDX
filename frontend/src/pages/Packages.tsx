import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { ParkingPackage, VehicleType, PackageForm } from '../types';

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<ParkingPackage[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<ParkingPackage | null>(null);
  const [form] = Form.useForm<PackageForm>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, vtRes] = await Promise.all([
        api.get<ParkingPackage[]>('/packages'),
        api.get<VehicleType[]>('/vehicle-types'),
      ]);
      setPackages(pRes.data);
      setVehicleTypes(vtRes.data);
    } catch (err) {
      message.error('Không tải được danh sách gói dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (values: PackageForm) => {
    try {
      if (editing) {
        await api.put(`/packages/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/packages', values);
        message.success('Thêm gói thành công');
      }
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: ParkingPackage) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      vehicleTypeId: record.vehicleTypeId,
      durationDays: record.durationDays,
      price: record.price,
      description: record.description,
    });
    setModal(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Nếu gói đã được sử dụng, hệ thống sẽ chặn xóa và yêu cầu ngừng áp dụng thay vì xóa cứng.',
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/packages/${id}`);
          message.success('Xóa thành công');
          fetchData();
        } catch (err) {
          const error = err as AxiosError<{ message: string }>;
          message.error(error.response?.data?.message || 'Không thể xóa');
        }
      },
    });
  };

  const columns = [
    { title: 'Tên gói', dataIndex: 'name', key: 'name' },
    { title: 'Loại xe', key: 'vehicleTypeName', render: (_: any, r: ParkingPackage) => r.vehicleType?.name || '-' },
    { title: 'Thời hạn (ngày)', dataIndex: 'durationDays', key: 'durationDays' },
    { title: 'Giá (đ)', dataIndex: 'price', key: 'price', render: (v: number) => Number(v).toLocaleString() },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (t?: string) => t || '-' },
    {
      title: 'Thao tác', key: 'action', width: 160, render: (_: any, r: ParkingPackage) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger>Xóa</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">Quản lý gói dịch vụ</h2>
      <Card>
        <div className="toolbar">
          <div className="toolbar-right">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              Thêm gói dịch vụ
            </Button>
          </div>
        </div>
        <Table columns={columns} dataSource={packages} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editing ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Tên gói" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="vehicleTypeId" label="Loại xe" rules={[{ required: true }]}>
            <Select placeholder="Chọn loại xe">
              {vehicleTypes.map((vt) => <Select.Option key={vt.id} value={vt.id}>{vt.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="durationDays" label="Thời hạn (ngày)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="price" label="Giá (đ)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/\$\s?|(,*)/g, '')) : 0) as any} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Packages;
