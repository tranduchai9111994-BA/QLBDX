import React, { useState, useEffect } from 'react';
import {
  Table, Button, Card, Modal, Form, Select, DatePicker,
  message, Tag, Space, Input, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, ReloadOutlined,
  SyncOutlined, UploadOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { AxiosError } from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { CustomerPackage, Customer, ParkingPackage, Vehicle, CustomerPackageForm } from '../types';
import { useLanguage } from '../context/LanguageContext';
import ImportModal, { ColumnDef, ReferenceSheet } from '../components/ImportModal';
import StatusTag from '../components/StatusTag';
import PermissionGate from '../components/PermissionGate';
import { confirmDanger } from '../utils/confirmDanger';
import { defaultPagination } from '../utils/tablePagination';

const { RangePicker } = DatePicker;

const CustomerPackages: React.FC = () => {
  const { t } = useLanguage();

  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<ParkingPackage[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  // Create modal
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm<CustomerPackageForm>();

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<CustomerPackage | null>(null);
  const [editForm] = Form.useForm();

  // Renew modal
  const [renewModal, setRenewModal] = useState(false);
  const [renewingPkg, setRenewingPkg] = useState<CustomerPackage | null>(null);
  const [renewForm] = Form.useForm();

  // Import modal
  const [importOpen, setImportOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: undefined as string | undefined,
    packageId: undefined as number | undefined,
    vehicleTypeId: undefined as number | undefined,
    fromDate: undefined as string | undefined,
    toDate: undefined as string | undefined,
  });

  const selectedCustomerId = Form.useWatch('customerId', form);
  const selectedVehicleId = Form.useWatch('vehicleId', form);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.packageId) params.packageId = filters.packageId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const [cpRes, cRes, pRes, vRes] = await Promise.all([
        api.get<CustomerPackage[]>('/customer-packages', { params }),
        api.get<Customer[]>('/customers'),
        api.get<ParkingPackage[]>('/packages'),
        api.get<Vehicle[]>('/vehicles'),
      ]);
      setCustomerPackages(cpRes.data);
      setCustomers(cRes.data);
      setPackages(pRes.data);
      setVehicles(vRes.data);
    } catch {
      message.error('Không tải được dữ liệu gói dịch vụ khách hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filters]);

  useEffect(() => {
    const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const currentPkg = packages.find((p) => p.id === form.getFieldValue('packageId'));
    if (currentVehicle && currentPkg && currentVehicle.vehicleTypeId !== currentPkg.vehicleTypeId) {
      form.setFieldValue('packageId', undefined);
    }
  }, [selectedVehicleId, vehicles, packages, form]);

  const filteredVehicles = vehicles.filter((v) => !selectedCustomerId || v.customerId === selectedCustomerId);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const filteredPackages = packages.filter((p) => !selectedVehicle || p.vehicleTypeId === selectedVehicle.vehicleTypeId);

  /* ── Ngày kết thúc: tự tính từ Gói + Ngày bắt đầu, nhưng cho phép admin sửa tay ─────
   * Chỉ auto-fill khi người dùng CHƯA từng tự sửa endDate trong lần mở modal này — tránh
   * ghi đè giá trị họ vừa chỉnh mỗi khi đổi gói/ngày bắt đầu. */
  const [endDateTouched, setEndDateTouched] = useState(false);
  const recomputeEndDate = (packageId?: number, startDate?: Dayjs) => {
    if (endDateTouched) return;
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg || !startDate) return;
    form.setFieldValue('endDate', startDate.add(pkg.durationDays, 'day'));
  };

  /* ── Create ───────────────────────────────────────────────────── */
  const handleSubmit = async (values: CustomerPackageForm) => {
    try {
      await api.post('/customer-packages', {
        customerId: values.customerId,
        packageId: values.packageId,
        vehicleId: values.vehicleId,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : undefined,
      });
      message.success('Đăng ký gói thành công');
      setModal(false);
      form.resetFields();
      setEndDateTouched(false);
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  /* ── Edit ─────────────────────────────────────────────────────── */
  const handleEdit = (record: CustomerPackage) => {
    setEditingPkg(record);
    editForm.setFieldsValue({
      customerId: record.customerId,
      vehicleId: record.vehicleId,
      status: record.status,
      startDate: dayjs(record.startDate),
      endDate: dayjs(record.endDate),
    });
    setEditModal(true);
  };

  const handleEditSubmit = async (values: Record<string, unknown>) => {
    if (!editingPkg) return;
    try {
      await api.put(`/customer-packages/${editingPkg.id}`, {
        customerId: values.customerId,
        vehicleId: values.vehicleId,
        status: values.status,
        startDate: (values.startDate as Dayjs).format('YYYY-MM-DD'),
        endDate: (values.endDate as Dayjs).format('YYYY-MM-DD'),
      });
      message.success('Cập nhật thành công');
      setEditModal(false);
      setEditingPkg(null);
      editForm.resetFields();
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  /* ── Cancel ───────────────────────────────────────────────────── */
  const handleCancelPackage = (record: CustomerPackage) => {
    confirmDanger({
      title: 'Xác nhận hủy gói',
      content: 'Gói sẽ được chuyển sang trạng thái "Đã hủy". Hệ thống giữ nguyên thanh toán và lịch sử.',
      okText: 'Hủy gói',
      cancelText: 'Đóng',
      successMessage: 'Đã hủy gói dịch vụ',
      errorFallback: 'Không thể hủy gói',
      onConfirm: async () => {
        await api.put(`/customer-packages/${record.id}`, {
          customerId: record.customerId, vehicleId: record.vehicleId, status: 'cancelled',
        });
        fetchData();
      },
    });
  };

  /* ── Renew ─────────────────────────────────────────────────────
   * Gói hết hạn → Gia hạn = tạo gói MỚI cùng khách/xe, bắt đầu từ hôm nay.
   * Gói cũ vẫn giữ trạng thái "Hết hạn" (đúng) để có lịch sử.
   * ─────────────────────────────────────────────────────────────── */
  const openRenew = (record: CustomerPackage) => {
    setRenewingPkg(record);
    renewForm.setFieldsValue({
      customerId: record.customerId,
      vehicleId: record.vehicleId,
      packageId: record.packageId,
      startDate: dayjs(),
    });
    setRenewModal(true);
  };

  const handleRenewSubmit = async (values: Record<string, unknown>) => {
    if (!renewingPkg) return;
    try {
      // Always use customerId/vehicleId from the original expired package (not editable form fields)
      // to avoid FK mismatch between customer and vehicle
      await api.post('/customer-packages', {
        customerId: renewingPkg.customerId,
        packageId: values.packageId,
        vehicleId: renewingPkg.vehicleId,
        startDate: (values.startDate as Dayjs).format('YYYY-MM-DD'),
      });
      message.success('Gia hạn gói thành công — gói mới đã được tạo');
      setRenewModal(false);
      setRenewingPkg(null);
      renewForm.resetFields();
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi khi gia hạn');
    }
  };

  /* ── Import ─────────────────────────────────────────────────── */
  const importColumns: ColumnDef[] = [
    { key: 'customerPhone', label: 'SĐT khách hàng', required: true, example: '0912345678', note: 'Số điện thoại đã đăng ký trong hệ thống' },
    { key: 'licensePlate',  label: 'Biển số xe',      required: true, example: '29A12345',   note: 'Biển số xe đã đăng ký trong hệ thống' },
    { key: 'packageName',   label: 'Tên gói dịch vụ', required: true, example: '',
      choices: packages.map((p) => p.name),
      note: 'Xem sheet Lựa chọn' },
    { key: 'startDate', label: 'Ngày bắt đầu', required: true, example: dayjs().format('YYYY-MM-DD'), note: 'YYYY-MM-DD (VD: 2026-08-01)' },
  ];

  const importRefSheets: ReferenceSheet[] = [
    {
      name: 'DS Gói dịch vụ',
      headers: ['Tên gói', 'Loại xe', 'Thời hạn (ngày)', 'Giá (VNĐ)'],
      rows: packages.map((p) => [p.name, p.vehicleType?.name ?? '-', String(p.durationDays ?? ''), String(Number(p.price).toLocaleString())]),
    },
    {
      name: 'DS Khách hàng',
      headers: ['Họ tên', 'SĐT', 'Biển số xe'],
      rows: customers.flatMap((c) =>
        vehicles.filter((v) => v.customerId === c.id).map((v) => [c.fullName, c.phone ?? '', v.licensePlate])
      ).slice(0, 200),
    },
  ];

  const handleImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      try {
        const customer = customers.find((c) => c.phone === row.customerPhone);
        if (!customer) { errors.push(`Dòng ${rowNum}: Không tìm thấy khách hàng SĐT "${row.customerPhone}"`); continue; }
        const vehicle = vehicles.find((v) => v.licensePlate === row.licensePlate.replace(/[-\s.]/g, '').toUpperCase() && v.customerId === customer.id);
        if (!vehicle) { errors.push(`Dòng ${rowNum}: Không tìm thấy xe "${row.licensePlate}" của khách này`); continue; }
        const pkg = packages.find((p) => p.name.trim() === row.packageName.trim());
        if (!pkg) { errors.push(`Dòng ${rowNum}: Không tìm thấy gói "${row.packageName}"`); continue; }
        if (!row.startDate) { errors.push(`Dòng ${rowNum}: Thiếu ngày bắt đầu`); continue; }

        await api.post('/customer-packages', {
          customerId: customer.id,
          packageId: pkg.id,
          vehicleId: vehicle.id,
          startDate: row.startDate,
        });
        success++;
      } catch (err) {
        const error = err as AxiosError<{ message: string }>;
        errors.push(`Dòng ${rowNum}: ${error.response?.data?.message ?? 'Lỗi không xác định'}`);
      }
    }
    if (success > 0) fetchData();
    return { success, errors };
  };

  /* ── Reset filters ──────────────────────────────────────────── */
  const resetFilters = () => {
    setSearchInput('');
    setFilters({ search: '', status: undefined, packageId: undefined, vehicleTypeId: undefined, fromDate: undefined, toDate: undefined });
  };

  /* ── Days remaining badge ─────────────────────────────────────── */
  const daysRemaining = (endDate: string) => {
    const diff = dayjs(endDate).diff(dayjs(), 'day');
    if (diff < 0) return null;
    if (diff <= 7) return <Badge count={`còn ${diff}n`} color="var(--warning)" style={{ fontSize: 11 }} />;
    if (diff <= 14) return <Badge count={`còn ${diff}n`} color="var(--primary)" style={{ fontSize: 11 }} />;
    return null;
  };

  /* ── Columns ─────────────────────────────────────────────────── */
  const columns = [
    {
      title: 'Khách hàng', key: 'customerName', width: 180, ellipsis: true,
      render: (_: unknown, r: CustomerPackage) => <span style={{ fontWeight: 500 }}>{r.customer?.fullName || '-'}</span>,
    },
    {
      title: 'Gói', key: 'packageName', width: 170, ellipsis: true,
      render: (_: unknown, r: CustomerPackage) => r.parkingPackage?.name || '-',
    },
    {
      title: 'Phương tiện', key: 'vehiclePlate', width: 130,
      render: (_: unknown, r: CustomerPackage) => <Tag className="plate-tag">{r.vehicle?.licensePlate || '-'}</Tag>,
    },
    {
      title: 'Bắt đầu', dataIndex: 'startDate', key: 'startDate', width: 120, ellipsis: true,
      render: (d: string) => dayjs(d).format('DD/MM/YYYY'),
    },
    {
      title: 'Kết thúc', dataIndex: 'endDate', key: 'endDate', width: 120, ellipsis: true,
      render: (d: string) => (
        <span style={{ color: dayjs(d).isBefore(dayjs()) ? 'var(--error)' : undefined }}>
          {dayjs(d).format('DD/MM/YYYY')}
        </span>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 170,
      render: (s: string, r: CustomerPackage) => (
        <Space size={4}>
          <StatusTag domain="customerPackage" value={s} />
          {s === 'active' && daysRemaining(r.endDate)}
        </Space>
      ),
    },
    {
      title: 'Thao tác', key: 'action', width: 280,
      render: (_: unknown, r: CustomerPackage) => (
        <PermissionGate adminOnly fallback={<Tag color="default">Staff chỉ được đăng ký mới</Tag>}>
          <Space wrap size={4}>
            <Tooltip title="Chỉnh sửa thông tin gói">
              <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
            </Tooltip>
            {(r.status === 'expired') && (
              <Tooltip title="Tạo gói mới kế tiếp cho khách/xe này">
                <Button
                  icon={<SyncOutlined />}
                  onClick={() => openRenew(r)}
                  size="small"
                  style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                >
                  Gia hạn
                </Button>
              </Tooltip>
            )}
            {r.status !== 'cancelled' && r.status !== 'expired' && (
              <Tooltip title="Hủy gói (giữ lịch sử)">
                <Button icon={<StopOutlined />} onClick={() => handleCancelPackage(r)} size="small" danger>Hủy gói</Button>
              </Tooltip>
            )}
          </Space>
        </PermissionGate>
      ),
    },
  ];

  /* ── Row class: highlight expired ───────────────────────────── */
  const rowClassName = (r: CustomerPackage) => {
    if (r.status === 'expired') return 'row-expired';
    if (r.status === 'active') {
      const diff = dayjs(r.endDate).diff(dayjs(), 'day');
      if (diff <= 7) return 'row-expiring-soon';
    }
    return '';
  };

  /* ── Vehicles watched in renew form ─────────────────────────── */
  const renewCustomerId = Form.useWatch('customerId', renewForm);
  const renewVehicles = vehicles.filter((v) => !renewCustomerId || v.customerId === renewCustomerId);
  const renewVehicleId = Form.useWatch('vehicleId', renewForm);
  const renewVehicle = vehicles.find((v) => v.id === renewVehicleId);
  const renewPackages = packages.filter((p) => !renewVehicle || p.vehicleTypeId === renewVehicle.vehicleTypeId);

  return (
    <div>
      <h2 className="page-title">{t('pageCustomerPackages')}</h2>
      <Card>
        <div className="toolbar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm khách hàng, biển số, tên gói..."
              style={{ width: 300 }}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
              allowClear
            />
            <Select
              value={filters.status} allowClear
              placeholder="Lọc trạng thái" style={{ width: 170 }}
              onChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}
              options={[
                { value: 'active',    label: '✅ Hoạt động' },
                { value: 'pending',   label: '⏳ Chưa hiệu lực' },
                { value: 'expired',   label: '🔴 Hết hạn' },
                { value: 'cancelled', label: '⛔ Đã hủy' },
              ]}
            />
            <Select
              value={filters.vehicleTypeId} allowClear
              placeholder="Lọc loại xe" style={{ width: 160 }}
              onChange={(v) => setFilters((prev) => ({ ...prev, vehicleTypeId: v }))}
              options={Array.from(new Map(packages.map((p) => [p.vehicleTypeId, p.vehicleType?.name ?? `Loại ${p.vehicleTypeId}`])).entries()).map(([value, label]) => ({ value, label }))}
            />
            <Select
              value={filters.packageId} allowClear
              placeholder="Lọc theo gói" style={{ width: 200 }}
              onChange={(v) => setFilters((prev) => ({ ...prev, packageId: v }))}
              options={packages.map((p) => ({ value: p.id, label: p.name }))}
            />
            <RangePicker
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={(dates: [Dayjs | null, Dayjs | null] | null) =>
                setFilters((prev) => ({
                  ...prev,
                  fromDate: dates?.[0]?.format('YYYY-MM-DD'),
                  toDate: dates?.[1]?.format('YYYY-MM-DD'),
                }))
              }
            />
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>Xóa bộ lọc</Button>
          </Space>
          <div className="toolbar-right">
            <Space>
              <PermissionGate adminOnly>
                <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                  {t('btnImport')}
                </Button>
              </PermissionGate>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setEndDateTouched(false); setModal(true); }}>
                Đăng ký gói dịch vụ
              </Button>
            </Space>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={customerPackages}
          rowKey="id"
          loading={loading}
          rowClassName={rowClassName}
          pagination={defaultPagination({ pageSize: 10 })}
        />
      </Card>

      {/* ── Create modal ── */}
      <Modal
        title="Đăng ký gói dịch vụ"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); setEndDateTouched(false); }}
        onOk={() => form.submit()}
        okText="Đăng ký" cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}>
            <Select showSearch placeholder="Chọn khách hàng"
              onChange={() => { form.setFieldValue('vehicleId', undefined); form.setFieldValue('packageId', undefined); }}
              filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
              {customers.map((c) => <Select.Option key={c.id} value={c.id}>{c.fullName} — {c.phone}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="vehicleId" label="Phương tiện" rules={[{ required: true, message: 'Vui lòng chọn phương tiện' }]}>
            <Select showSearch placeholder="Chọn phương tiện"
              filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
              {filteredVehicles.map((v) => <Select.Option key={v.id} value={v.id}>{v.licensePlate} — {v.customer?.fullName || ''}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="packageId" label="Gói dịch vụ" rules={[{ required: true, message: 'Vui lòng chọn gói' }]}>
            <Select
              placeholder={selectedVehicle ? 'Chọn gói theo loại xe' : 'Chọn phương tiện trước'}
              onChange={(v) => recomputeEndDate(v, form.getFieldValue('startDate'))}
            >
              {filteredPackages.map((p) => <Select.Option key={p.id} value={p.id}>{p.name} — {Number(p.price).toLocaleString()}đ ({p.durationDays} ngày)</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              onChange={(d) => recomputeEndDate(form.getFieldValue('packageId'), d ?? undefined)}
            />
          </Form.Item>
          <Form.Item
            name="endDate"
            label="Ngày kết thúc"
            rules={[{ required: true, message: 'Vui lòng chọn ngày kết thúc' }]}
            tooltip="Tự tính từ Gói + Ngày bắt đầu, có thể chỉnh tay nếu cần (VD: tặng thêm ngày, gia hạn lệch chu kỳ)"
          >
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: '100%' }}
              onChange={() => setEndDateTouched(true)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Edit modal ── */}
      <Modal
        title="Cập nhật gói dịch vụ"
        open={editModal}
        onCancel={() => { setEditModal(false); setEditingPkg(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        okText="Cập nhật" cancelText="Hủy"
      >
        {editingPkg && (
          <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
            <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: 8 }}>
              <div><strong>Gói:</strong> {editingPkg.parkingPackage?.name}</div>
            </div>
            <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true }]}>
              <Select showSearch filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
                {customers.map((c) => <Select.Option key={c.id} value={c.id}>{c.fullName} — {c.phone}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="vehicleId" label="Phương tiện" rules={[{ required: true }]}>
              <Select showSearch filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())}>
                {vehicles.map((v) => <Select.Option key={v.id} value={v.id}>{v.licensePlate} — {v.customer?.fullName || ''}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="active">Hoạt động</Select.Option>
                <Select.Option value="pending">Chưa hiệu lực</Select.Option>
                <Select.Option value="expired">Hết hạn</Select.Option>
                <Select.Option value="cancelled">Đã hủy</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="startDate" label="Ngày bắt đầu" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="endDate" label="Ngày kết thúc" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ── Renew modal ── */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: 'var(--primary)' }} />
            Gia hạn gói dịch vụ
          </Space>
        }
        open={renewModal}
        onCancel={() => { setRenewModal(false); setRenewingPkg(null); renewForm.resetFields(); }}
        onOk={() => renewForm.submit()}
        okText="Xác nhận gia hạn" cancelText="Hủy"
      >
        {renewingPkg && (
          <>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--warning-container)', borderRadius: 8, borderLeft: '4px solid var(--warning)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Gói hết hạn:</div>
              <div><strong>Khách:</strong> {renewingPkg.customer?.fullName}</div>
              <div><strong>Gói cũ:</strong> {renewingPkg.parkingPackage?.name}</div>
              <div><strong>Hết hạn:</strong> {dayjs(renewingPkg.endDate).format('DD/MM/YYYY')}</div>
              <div style={{ marginTop: 6, color: 'var(--outline)', fontSize: 12 }}>
                Gói cũ giữ nguyên trạng thái "Hết hạn" trong lịch sử. Gói mới sẽ được tạo.
              </div>
            </div>
            <Form form={renewForm} layout="vertical" onFinish={handleRenewSubmit}>
              {/* Customer & vehicle are fixed from the expired package — display only */}
              <Form.Item label="Khách hàng">
                <Input disabled value={renewingPkg.customer?.fullName + (renewingPkg.customer?.phone ? ` — ${renewingPkg.customer.phone}` : '')} />
              </Form.Item>
              <Form.Item label="Phương tiện">
                <Input disabled value={renewingPkg.vehicle?.licensePlate} />
              </Form.Item>
              <Form.Item name="packageId" label="Gói dịch vụ mới" rules={[{ required: true, message: 'Vui lòng chọn gói' }]}>
                <Select placeholder="Chọn gói dịch vụ mới">
                  {renewPackages.map((p) => <Select.Option key={p.id} value={p.id}>{p.name} — {Number(p.price).toLocaleString()}đ ({p.durationDays} ngày)</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="startDate" label="Ngày bắt đầu gói mới" rules={[{ required: true }]} initialValue={dayjs()}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* ── Import modal ── */}
      <ImportModal
        open={importOpen}
        title={t('menuCustomerPackages')}
        columns={importColumns}
        referenceSheets={importRefSheets}
        onImport={handleImport}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
};

export default CustomerPackages;
