/**
 * Màn hình DANH MỤC GÓI DỊCH VỤ (gói tháng / quý / năm theo từng loại xe).
 *
 * Phân biệt với màn hình "Đăng ký gói": ở đây khai báo gói để bán, còn bên kia là ghi nhận khách
 * nào đã mua gói nào.
 *
 * ===========================================================================================
 * HAI KHÁI NIỆM RẤT DỄ NHẦM — nắm chắc trước khi đọc code:
 *
 *                 | DANH MỤC GÓI (file này)      | GÓI KHÁCH ĐÃ MUA (CustomerPackages.tsx)
 *   Bảng DB       | ParkingPackages              | CustomerPackages
 *   Service       | package.service.ts           | customerPackage.service.ts
 *   Nghĩa         | "Gói tháng xe máy - 300.000đ"| "Anh A mua gói đó cho xe 29A-12345,
 *                 |  (mặt hàng bày trên kệ)      |   từ 1/9 đến 30/9" (hoá đơn đã bán)
 *
 * Ví von: file này là BẢNG GIÁ dán trên tường, file kia là các VÉ ĐÃ BÁN.
 *
 * Màn hình có cơ chế GIÁ HAI LỚP giống hệt Loại xe (VehicleTypes.tsx) — đọc phần đầu file đó
 * để hiểu cặn kẽ. Ba modal: Thêm/Sửa, Đặt lịch đổi giá, Xem lịch sử giá.
 *
 * Riêng của màn hình này: "THỜI GIAN BÁN" (validFrom / validTo) — khoảng thời gian gói được
 * phép bán, dùng cho gói khuyến mãi theo mùa. Đừng nhầm với `durationDays` (gói dùng được bao
 * nhiêu ngày) hay với ngày bắt đầu/kết thúc của gói khách đã mua.
 * ===========================================================================================
 */
import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, InputNumber, Select, DatePicker, message, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, StopOutlined, CheckCircleOutlined, ClockCircleOutlined, HistoryOutlined, UploadOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { ParkingPackage, VehicleType, PackageForm, SchedulePriceChangeForm, PriceHistoryEntry } from '../types';
import { useLanguage } from '../context/LanguageContext';
import ImportModal, { ColumnDef, ReferenceSheet } from '../components/ImportModal';
import StatusTag from '../components/StatusTag';
import PermissionGate from '../components/PermissionGate';
import FilterBar from '../components/FilterBar';
import { confirmDanger } from '../utils/confirmDanger';
import { defaultPagination } from '../utils/tablePagination';

const Packages: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  const { t } = useLanguage();
  const [packages, setPackages] = useState<ParkingPackage[]>([]);
  // Danh mục phụ: mỗi gói gắn với một loại xe, cần danh sách này để đổ vào ô Select và để tra
  // id khi nhập từ Excel.
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<ParkingPackage | null>(null);
  const [form] = Form.useForm<PackageForm>();
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    vehicleTypeId: undefined as number | undefined,
    status: 'all',
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    minDuration: undefined as number | undefined,
    maxDuration: undefined as number | undefined,
  });

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Tải danh sách gói (có lọc) + danh mục loại xe.
   *
   * Cũng là một "điểm đồng bộ giá": backend chạy syncDuePackagePrices() trước khi trả dữ liệu,
   * nên lịch đổi giá đã tới hạn được áp dụng ngay tại đây (xem pricing.service.ts).
   */
  const fetchData = async () => {
    setLoading(true);
    try {
      // includeInactive: màn hình quản trị phải thấy cả gói đã ngừng bán, để còn kích hoạt lại.
      const params: Record<string, string | number | boolean> = { includeInactive: true };
      if (filters.search) params.search = filters.search;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      if (filters.status === 'active') params.isActive = true;
      if (filters.status === 'inactive') params.isActive = false;
      if (filters.minPrice !== undefined) params.minPrice = filters.minPrice;
      if (filters.maxPrice !== undefined) params.maxPrice = filters.maxPrice;
      if (filters.minDuration !== undefined) params.minDuration = filters.minDuration;
      if (filters.maxDuration !== undefined) params.maxDuration = filters.maxDuration;

      const [pRes, vtRes] = await Promise.all([
        api.get<ParkingPackage[]>('/packages', { params }),
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

  useEffect(() => { fetchData(); }, [filters]);

  const [submitting, setSubmitting] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<ParkingPackage | null>(null);
  const [scheduleForm] = Form.useForm<SchedulePriceChangeForm>();
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<ParkingPackage | null>(null);
  const [historyData, setHistoryData] = useState<PriceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleSubmit = async (values: PackageForm) => {
    setSubmitting(true);
    try {
      // Đổi hai ô ngày từ đối tượng dayjs sang chuỗi 'YYYY-MM-DD' trước khi gửi.
      // Gửi `null` (không phải undefined) khi người dùng bỏ trống: null nghĩa là "xoá giới hạn
      // này đi", còn undefined thì backend hiểu là "không đụng tới" và giới hạn cũ vẫn còn.
      const payload = {
        ...values,
        validFrom: values.validFrom ? (values.validFrom as Dayjs).format('YYYY-MM-DD') : null,
        validTo: values.validTo ? (values.validTo as Dayjs).format('YYYY-MM-DD') : null,
      };
      if (editing) {
        // Gửi kèm `isActive` HIỆN TẠI của gói. Bắt buộc, vì form không có ô trạng thái nên
        // không gửi thì backend nhận undefined và đặt về mặc định (đang bán) — hệ quả: sửa
        // mô tả cho một gói đã ngừng bán lại vô tình bật nó bán trở lại.
        await api.put(`/packages/${editing.id}`, { ...payload, isActive: editing.isActive });
        message.success('Cập nhật thành công');
      } else {
        await api.post('/packages', payload);
        message.success('Thêm gói thành công');
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

  const handleEdit = (record: ParkingPackage) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      vehicleTypeId: record.vehicleTypeId,
      durationDays: record.durationDays,
      price: record.price,
      description: record.description,
      validFrom: record.validFrom ? dayjs(record.validFrom) : undefined,
      validTo: record.validTo ? dayjs(record.validTo) : undefined,
    });
    setModal(true);
  };

  const handleDelete = (id: number) => {
    confirmDanger({
      content: 'Nếu gói đã được sử dụng, hệ thống sẽ chặn xóa và yêu cầu ngừng áp dụng thay vì xóa cứng.',
      successMessage: 'Xóa thành công',
      errorFallback: 'Không thể xóa',
      onConfirm: async () => {
        await api.delete(`/packages/${id}`);
        fetchData();
      },
    });
  };

  /**
   * NGỪNG ÁP DỤNG / KÍCH HOẠT LẠI gói — khác hẳn với Xoá.
   *
   *   Ngừng áp dụng : gói biến khỏi danh sách bán, NHƯNG khách đã mua vẫn dùng hết hạn bình
   *                   thường và lịch sử doanh thu vẫn còn tên gói. Đây là thao tác thường dùng.
   *   Xoá           : chỉ làm được với gói CHƯA AI MUA (backend chặn), ví dụ vừa tạo nhầm.
   *
   * Vì sao cần cả hai: bãi xe ngừng bán gói năm nhưng vẫn còn khách đang dùng gói năm — xoá đi
   * thì các vé đó mất tham chiếu. Đây là mẫu "xoá mềm" quen thuộc trong hệ thống nghiệp vụ.
   */
  const handleToggleActive = async (record: ParkingPackage, isActive: boolean) => {
    try {
      // Gửi lại ĐẦY ĐỦ các field cũ kèm `isActive` mới, vì API là PUT (thay thế toàn bộ bản
      // ghi) chứ không phải PATCH (sửa một phần). Gửi mỗi `isActive` sẽ xoá trắng các field
      // còn lại.
      await api.put(`/packages/${record.id}`, {
        name: record.name,
        vehicleTypeId: record.vehicleTypeId,
        durationDays: record.durationDays,
        price: record.price,
        description: record.description,
        isActive,
      });
      message.success(isActive ? 'Đã kích hoạt lại gói dịch vụ' : 'Đã ngừng áp dụng gói dịch vụ');
      fetchData();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Không thể cập nhật trạng thái gói');
    }
  };

  /* ══ KHỐI 3 — GIÁ HAI LỚP ═════════════════════════════════════════════════════════════
     Giống hệt VehicleTypes.tsx: bảng chính giữ giá hiện hành, bảng PackagePriceHistory lưu mọi
     lần đổi kèm ngày hiệu lực và người đổi. Đọc phần đầu VehicleTypes.tsx để hiểu vì sao.    */

  /** Mở form đặt lịch đổi giá, điền sẵn giá hiện tại và ngày hôm nay. */
  const openScheduleModal = (record: ParkingPackage) => {
    setScheduleTarget(record);
    scheduleForm.setFieldsValue({
      price: record.price,
      effectiveFrom: dayjs(),
    });
  };

  /**
   * Gửi lịch đổi giá -> POST /packages/:id/price-changes (GHI THÊM một dòng lịch sử).
   * Khác với PUT /packages/:id ở handleSubmit (GHI ĐÈ giá hiện hành, áp dụng ngay).
   */
  const handleScheduleSubmit = async (values: SchedulePriceChangeForm) => {
    if (!scheduleTarget) return;
    setScheduleSubmitting(true);
    try {
      const res = await api.post(`/packages/${scheduleTarget.id}/price-changes`, {
        price: values.price,
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

  const openHistoryModal = async (record: ParkingPackage) => {
    setHistoryTarget(record);
    setHistoryLoading(true);
    try {
      const res = await api.get<PriceHistoryEntry[]>(`/packages/${record.id}/price-changes`);
      setHistoryData(res.data);
    } catch {
      message.error('Không tải được lịch sử giá');
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ══ KHỐI 4 — NHẬP TỪ EXCEL ═══════════════════════════════════════════════════════════ */
  const importColumns: ColumnDef[] = [
    { key: 'name', label: 'Tên gói', required: true, example: 'Vé tháng xe máy' },
    { key: 'vehicleType', label: 'Loại xe', required: true, example: '',
      choices: vehicleTypes.map((vt) => vt.name), note: 'Xem sheet Lựa chọn' },
    { key: 'durationDays', label: 'Thời hạn (ngày)', required: true, example: '30' },
    { key: 'price', label: 'Giá (đ)', required: true, example: '200000' },
    { key: 'description', label: 'Mô tả', required: false, example: 'Gói gửi xe máy theo tháng' },
  ];

  const importRefSheets: ReferenceSheet[] = [
    {
      name: 'DS Loại xe',
      headers: ['Loại xe', 'Mô tả'],
      rows: vehicleTypes.map((vt) => [vt.name, vt.description ?? '']),
    },
  ];

  const handleImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      if (!row.name || !row.vehicleType || !row.durationDays || !row.price) {
        errors.push(`Dòng ${rowNum}: Thiếu Tên gói, Loại xe, Thời hạn hoặc Giá`);
        continue;
      }
      const vt = vehicleTypes.find((vt) => vt.name.trim() === row.vehicleType.trim());
      if (!vt) { errors.push(`Dòng ${rowNum}: Không tìm thấy loại xe "${row.vehicleType}"`); continue; }
      // Ô Excel luôn về dưới dạng CHUỖI, phải tự đổi sang số và tự kiểm tra.
      // Number.isFinite bắt được cả ba trường hợp hỏng: chữ ("ba mươi" -> NaN), ô trống, và
      // Infinity. Chỉ viết `!durationDays` thì lọt giá trị âm hoặc chuỗi lạ.
      const durationDays = Number(row.durationDays);
      const price = Number(row.price);
      if (!Number.isFinite(durationDays) || durationDays <= 0) {
        errors.push(`Dòng ${rowNum}: Thời hạn "${row.durationDays}" không hợp lệ`);
        continue;
      }
      if (!Number.isFinite(price) || price <= 0) {
        errors.push(`Dòng ${rowNum}: Giá "${row.price}" không hợp lệ`);
        continue;
      }
      try {
        await api.post('/packages', {
          name: row.name,
          vehicleTypeId: vt.id,
          durationDays,
          price,
          description: row.description || undefined,
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

  const resetFilters = () => {
    setSearchInput('');
    setFilters({
      search: '',
      vehicleTypeId: undefined,
      status: 'all',
      minPrice: undefined,
      maxPrice: undefined,
      minDuration: undefined,
      maxDuration: undefined,
    });
  };

  /* ══ KHỐI 5 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  const columns = [
    { title: t('colPackage'), dataIndex: 'name', key: 'name', width: 200, ellipsis: true, render: (value: string) => <span style={{ fontWeight: 500 }}>{value}</span> },
    { title: t('colVehicleType'), key: 'vehicleTypeName', width: 150, ellipsis: true, render: (_: any, r: ParkingPackage) => r.vehicleType?.name || '-' },
    { title: t('colPackageDuration'), dataIndex: 'durationDays', key: 'durationDays', width: 110, ellipsis: true },
    {
      title: t('fieldPrice'), dataIndex: 'price', key: 'price', width: 140, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
    },
    { title: t('fieldNote'), dataIndex: 'description', key: 'description', width: 250, ellipsis: true, render: (v?: string) => v || '-' },
    {
      title: 'Thời gian bán', key: 'validWindow', width: 190, ellipsis: true,
      // Cột "Thời gian bán" — khoảng thời gian gói được phép bán (KHÔNG phải thời hạn sử dụng
      // của gói). Ba trạng thái hiển thị:
      //   không đặt giới hạn nào -> "Quanh năm"
      //   chỉ đặt một đầu        -> đầu còn lại hiện dấu "…" (không giới hạn)
      //   hôm nay ngoài khoảng   -> tô ĐỎ, báo gói đang không bán được dù trạng thái vẫn bật
      render: (_: any, r: ParkingPackage) => {
        if (!r.validFrom && !r.validTo) return <span style={{ color: 'var(--outline)' }}>Quanh năm</span>;
        const from = r.validFrom ? dayjs(r.validFrom).format('DD/MM/YYYY') : '…';
        const to = r.validTo ? dayjs(r.validTo).format('DD/MM/YYYY') : '…';
        // Tham số 'day' bắt dayjs so sánh theo ĐƠN VỊ NGÀY, bỏ qua giờ phút. Thiếu nó thì gói
        // có hiệu lực từ hôm nay sẽ bị coi là "chưa tới hạn" suốt cả ngày hôm nay.
        const outOfWindow = (r.validFrom && dayjs().isBefore(dayjs(r.validFrom), 'day')) || (r.validTo && dayjs().isAfter(dayjs(r.validTo), 'day'));
        return <span style={{ color: outOfWindow ? 'var(--error)' : undefined }}>{from} – {to}</span>;
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean) => <StatusTag domain="toggle" value={isActive} />,
    },
    {
      title: 'Thao tác', key: 'action', width: 420, render: (_: any, r: ParkingPackage) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<HistoryOutlined />} onClick={() => openHistoryModal(r)} size="small">Lịch sử giá</Button>
          <PermissionGate screen="packages" action="update" fallback={<Tag color="default">Chỉ quản trị được sửa</Tag>}>
            <Button icon={<ClockCircleOutlined />} onClick={() => openScheduleModal(r)} size="small">Đặt lịch đổi giá</Button>
            <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
            {/* Một chỗ, hai nút đối nghịch — đang bán thì hiện "Ngừng áp dụng", đã ngừng thì
                hiện "Kích hoạt lại". Hiện cả hai cùng lúc sẽ luôn có một nút vô nghĩa. */}
            {r.isActive ? (
              <Button icon={<StopOutlined />} onClick={() => handleToggleActive(r, false)} size="small">Ngừng áp dụng</Button>
            ) : (
              <Button icon={<CheckCircleOutlined />} onClick={() => handleToggleActive(r, true)} size="small" type="primary" ghost>Kích hoạt lại</Button>
            )}
          </PermissionGate>
          <PermissionGate screen="packages" action="delete">
            <Button icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)} size="small" danger>Xóa</Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pagePackages')}</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <PermissionGate screen="packages" action="create">
          <Space>
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>{t('btnImport')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>
              {t('btnAddPackage')}
            </Button>
          </Space>
        </PermissionGate>
      </div>
      <div>
        <FilterBar onReset={resetFilters}>
          <Input.Search
            placeholder="Tìm tên gói, mô tả, loại xe..."
            style={{ width: 320 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(value) => setFilters((prev) => ({ ...prev, search: value.trim() }))}
            allowClear
          />
          <Select
            value={filters.vehicleTypeId}
            allowClear
            placeholder="Lọc theo loại xe"
            style={{ width: 180 }}
            onChange={(value) => setFilters((prev) => ({ ...prev, vehicleTypeId: value }))}
            options={vehicleTypes.map((vehicleType) => ({
              value: vehicleType.id,
              label: vehicleType.name,
            }))}
          />
          <Select
            value={filters.status}
            style={{ width: 180 }}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang áp dụng' },
              { value: 'inactive', label: 'Ngừng áp dụng' },
            ]}
          />
          <InputNumber
            placeholder="Giá từ"
            style={{ width: 130 }}
            value={filters.minPrice}
            onChange={(value) => setFilters((prev) => ({ ...prev, minPrice: value ?? undefined }))}
            min={0}
          />
          <InputNumber
            placeholder="Giá đến"
            style={{ width: 130 }}
            value={filters.maxPrice}
            onChange={(value) => setFilters((prev) => ({ ...prev, maxPrice: value ?? undefined }))}
            min={0}
          />
          <InputNumber
            placeholder="Ngày từ"
            style={{ width: 120 }}
            value={filters.minDuration}
            onChange={(value) => setFilters((prev) => ({ ...prev, minDuration: value ?? undefined }))}
            min={1}
          />
          <InputNumber
            placeholder="Ngày đến"
            style={{ width: 120 }}
            value={filters.maxDuration}
            onChange={(value) => setFilters((prev) => ({ ...prev, maxDuration: value ?? undefined }))}
            min={1}
          />
        </FilterBar>
      </div>
      <Card>
        <Table columns={columns} dataSource={packages} rowKey="id" loading={loading} pagination={defaultPagination({ pageSize: 10 })} />
      </Card>

      <ImportModal
        open={importOpen}
        title={t('menuPackages')}
        columns={importColumns}
        referenceSheets={importRefSheets}
        onImport={handleImport}
        onClose={() => setImportOpen(false)}
      />

      <Modal
        title={editing ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
        open={modal}
        onCancel={() => { setModal(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        okButtonProps={{ loading: submitting }}
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
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Hai ô "Thời gian bán" đều KHÔNG bắt buộc. Bỏ trống = không giới hạn đầu đó.
                Dùng cho gói khuyến mãi theo mùa (VD chỉ bán trong tháng Tết). */}
            <Form.Item name="validFrom" label="Bán từ ngày" style={{ flex: 1 }} tooltip="Bỏ trống = bán ngay, không giới hạn ngày bắt đầu">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Không giới hạn" />
            </Form.Item>
            <Form.Item name="validTo" label="Bán đến ngày" style={{ flex: 1 }} tooltip="Bỏ trống = bán quanh năm, không giới hạn ngày kết thúc. VD gói khuyến mãi theo mùa.">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Không giới hạn" />
            </Form.Item>
          </div>
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
          tự động áp dụng đúng ngày đó. Khách đã đăng ký gói giữ nguyên giá đã trả, không bị ảnh hưởng.
        </p>
        <Form form={scheduleForm} layout="vertical" onFinish={handleScheduleSubmit}>
          <Form.Item name="price" label="Giá mới (đ)" rules={[{ required: true }]}>
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
        width={560}
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
              render: (_: any, r: PriceHistoryEntry) => (
                <Tag color={dayjs(r.effectiveFrom).isAfter(dayjs()) ? 'blue' : 'green'}>
                  {dayjs(r.effectiveFrom).isAfter(dayjs()) ? 'Sắp áp dụng' : 'Đã áp dụng'}
                </Tag>
              ),
            },
            { title: 'Hiệu lực từ', dataIndex: 'effectiveFrom', key: 'effectiveFrom', width: 120, ellipsis: true, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
            {
              title: 'Giá', dataIndex: 'price', key: 'price', width: 130, align: 'right' as const,
              render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toLocaleString()}đ</span>,
            },
            { title: 'Người đổi', key: 'changer', width: 140, ellipsis: true, render: (_: any, r: PriceHistoryEntry) => r.changer?.fullName || '-' },
          ]}
          locale={{ emptyText: 'Chưa có lịch sử đổi giá — giá hiện tại là giá gốc khi tạo gói' }}
        />
      </Modal>
    </div>
  );
};

export default Packages;
