/**
 * Màn hình KHÁCH HÀNG (chủ phương tiện).
 *
 * Khách hàng chỉ được NGỪNG HOẠT ĐỘNG chứ không xoá hẳn, vì dữ liệu gửi xe và doanh thu đều
 * tham chiếu tới khách (xem backend/src/services/customer.service.ts).
 */
import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, message, Popconfirm, Select, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { Customer, CustomerForm } from '../types';
import { useLanguage } from '../context/LanguageContext';
import ImportModal, { ColumnDef } from '../components/ImportModal';
import StatusTag from '../components/StatusTag';
import PermissionGate from '../components/PermissionGate';
import FilterBar from '../components/FilterBar';
import { defaultPagination } from '../utils/tablePagination';

const Customers: React.FC = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });
  const [form] = Form.useForm<CustomerForm>();
  const [importOpen, setImportOpen] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = { includeInactive: true };
      if (filters.search) params.search = filters.search;
      if (filters.status === 'active') params.isActive = true;
      if (filters.status === 'inactive') params.isActive = false;
      const res = await api.get<Customer[]>('/customers', { params });
      setCustomers(res.data);
    } catch (err) {
      message.error('Không tải được danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [filters]);

  const handleSubmit = async (values: CustomerForm) => {
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/customers', values);
        message.success('Thêm khách hàng thành công');
      }
      setModal(false);
      form.resetFields();
      setEditing(null);
      fetchCustomers();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleEdit = (record: Customer) => {
    setEditing(record);
    form.setFieldsValue({
      fullName: record.fullName,
      phone: record.phone,
      email: record.email,
      address: record.address,
      identityCard: record.identityCard,
    });
    setModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/customers/${id}`);
      message.success('Ngừng hoạt động khách hàng thành công');
      fetchCustomers();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setFilters({ search: '', status: 'all' });
  };

  /* ── Import ─────────────────────────────────────────────────── */
  const importColumns: ColumnDef[] = [
    { key: 'fullName',     label: 'Họ tên',       required: true, example: 'Nguyễn Văn A' },
    { key: 'phone',        label: 'Số điện thoại', required: true, example: '0912345678',   note: '8-15 chữ số' },
    { key: 'email',        label: 'Email',          required: false, example: 'a@mail.com' },
    { key: 'identityCard', label: 'CMND/CCCD',     required: false, example: '001234567890', note: '9-12 chữ số' },
    { key: 'address',      label: 'Địa chỉ',       required: false, example: '123 Phố Huế, Hà Nội' },
  ];

  const handleImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      if (!row.fullName || !row.phone) {
        errors.push(`Dòng ${rowNum}: Thiếu Họ tên hoặc SĐT`);
        continue;
      }
      try {
        await api.post('/customers', {
          fullName: row.fullName,
          phone: row.phone,
          email: row.email || undefined,
          identityCard: row.identityCard || undefined,
          address: row.address || undefined,
        });
        success++;
      } catch (err) {
        const error = err as AxiosError<{ message: string }>;
        errors.push(`Dòng ${rowNum}: ${error.response?.data?.message ?? 'Lỗi không xác định'}`);
      }
    }
    if (success > 0) fetchCustomers();
    return { success, errors };
  };

  const columns = [
    { title: t('fieldName'), dataIndex: 'fullName', key: 'fullName', width: 180, ellipsis: true, render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: t('fieldPhone'), dataIndex: 'phone', key: 'phone', width: 130, ellipsis: true },
    { title: t('fieldEmail'), dataIndex: 'email', key: 'email', width: 200, ellipsis: true, render: (v?: string) => v || '-' },
    { title: t('colIdentityCard'), dataIndex: 'identityCard', key: 'identityCard', width: 140, ellipsis: true, render: (v?: string) => v || '-' },
    { title: t('fieldAddress'), dataIndex: 'address', key: 'address', width: 250, ellipsis: true, render: (v?: string) => v || '-' },
    {
      title: t('fieldStatus'), dataIndex: 'isActive', key: 'isActive', width: 130,
      render: (isActive: boolean) => (
        <StatusTag domain="toggle" value={isActive} label={isActive ? t('statusActive') : t('statusInactive')} />
      ),
    },
    {
      title: t('fieldAction'), key: 'action', width: 220,
      render: (_: unknown, r: Customer) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PermissionGate screen="customers" action="update">
            <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">{t('btnEdit')}</Button>
          </PermissionGate>
          <PermissionGate screen="customers" action="delete">
            <Popconfirm title={t('confirmDelete')} onConfirm={() => handleDelete(r.id)}>
              <Button icon={<DeleteOutlined />} danger size="small" disabled={!r.isActive}>{t('statusInactive')}</Button>
            </Popconfirm>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pageCustomers')}</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <PermissionGate screen="customers" action="create">
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>{t('btnImport')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              {t('btnAddCustomer')}
            </Button>
          </Space>
        </PermissionGate>
      </div>
      <FilterBar onReset={resetFilters}>
        <Input.Search
          placeholder="Tìm tên, SĐT, CCCD, email..."
          style={{ width: 320 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
          allowClear
        />
        <Select
          value={filters.status}
          style={{ width: 190 }}
          onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
          options={[
            { value: 'all', label: 'Tất cả trạng thái' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'inactive', label: 'Ngừng hoạt động' },
          ]}
        />
      </FilterBar>
      <Card>
        <Table columns={columns} dataSource={customers} rowKey="id" loading={loading} pagination={defaultPagination({ pageSize: 10 })} />
      </Card>

      <ImportModal
        open={importOpen}
        title={t('menuCustomers')}
        columns={importColumns}
        onImport={handleImport}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        title={editing ? t('btnEdit') + ' ' + t('menuCustomers').toLowerCase() : t('btnAddCustomer')}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? t('btnUpdate') : t('btnAdd')}
        cancelText={t('btnCancel')}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập SĐT' }, { pattern: /^[0-9\s.+-]{8,15}$/, message: 'Số điện thoại không hợp lệ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="identityCard" label="CMND/CCCD" rules={[{ pattern: /^[0-9]{9,12}$/, message: 'CMND/CCCD phải gồm 9-12 chữ số' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Customers;
