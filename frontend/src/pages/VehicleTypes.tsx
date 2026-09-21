/**
 * Màn hình LOẠI XE & BẢNG GIÁ (danh mục).
 *
 * Đây là nơi khai báo đơn giá theo giờ / ngày / tháng cho từng loại xe — gốc của mọi phép tính
 * tiền gửi xe. Ngoài sửa giá áp dụng ngay, còn đặt được LỊCH đổi giá cho ngày trong tương lai và
 * xem lại lịch sử giá (xem backend/src/services/vehicleType.service.ts).
 *
 * ===========================================================================================
 * CƠ CHẾ GIÁ HAI LỚP - ý tưởng quan trọng nhất của màn hình này:
 *
 *   Bảng VehicleTypes            -> giá HIỆN HÀNH (đang bán)
 *   Bảng VehicleTypeRateHistory  -> MỌI lần đổi giá + ngày hiệu lực + ai đổi
 *
 * Nhờ tách hai bảng mà làm được ba việc mà "sửa đè giá cũ" không làm được:
 *   1. Hẹn trước lịch tăng giá cho một ngày trong tương lai.
 *   2. Truy vết ai đổi giá, đổi lúc nào (đối soát khi có khiếu nại).
 *   3. Lượt xe đang gửi KHÔNG bị ảnh hưởng, vì lúc xe vào backend đã chép giá vào chính bản
 *      ghi lượt gửi (hourlyRateApplied / dailyRateApplied) - xem parking.service.ts.
 *
 * Việc "tới ngày thì áp dụng" do backend/src/services/pricing.service.ts làm, KHÔNG có tiến
 * trình chạy nền: hệ thống chỉ đồng bộ tại các điểm đọc giá quan trọng (mở danh sách loại xe,
 * mở danh sách gói, và lúc xe vào bãi), cộng thêm một lần lúc server khởi động để bù cho
 * trường hợp server tắt qua đêm đúng ngày đổi giá.
 *
 * Màn hình có BA modal, đừng nhầm lẫn:
 *   Modal 1 (`modal`)          - Thêm/Sửa loại xe  -> đổi giá ÁP DỤNG NGAY
 *   Modal 2 (`scheduleTarget`) - Đặt lịch đổi giá  -> ghi một dòng vào bảng lịch sử
 *   Modal 3 (`historyTarget`)  - Xem lịch sử giá   -> chỉ đọc, không sửa
 * ===========================================================================================
 */
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
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════
     Nhiều state hơn trang danh mục thường vì có tới ba modal. Nhóm theo modal cho dễ đọc. */
  const { t } = useLanguage();
  const [types, setTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState('');

  // --- Modal 1: Thêm / Sửa loại xe ---
  const [modal, setModal] = useState<boolean>(false);
  const [editing, setEditing] = useState<VehicleType | null>(null);   // null = thêm mới
  const [form] = Form.useForm<VehicleTypeForm>();
  const [submitting, setSubmitting] = useState(false);

  // --- Modal 2: Đặt lịch đổi giá ---
  // `scheduleTarget` gánh HAI vai: vừa là cờ mở modal (open={!!scheduleTarget}), vừa giữ loại
  // xe đang thao tác. Gộp như vậy thì không bao giờ xảy ra cảnh modal mở mà chưa biết đang
  // đặt lịch cho loại xe nào.
  const [scheduleTarget, setScheduleTarget] = useState<VehicleType | null>(null);
  const [scheduleForm] = Form.useForm<ScheduleRateChangeForm>();
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  // --- Modal 3: Xem lịch sử giá (chỉ đọc) ---
  const [historyTarget, setHistoryTarget] = useState<VehicleType | null>(null);
  const [historyData, setHistoryData] = useState<RateHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Tải danh sách loại xe.
   *
   * Chính lời gọi này cũng là một "điểm đồng bộ giá": backend chạy syncDueVehicleTypeRates() trước khi
   * trả dữ liệu, nên nếu có lịch đổi giá đã tới hạn thì giá hiện hành được cập nhật ngay tại
   * đây. Đó là lý do hệ thống không cần tiến trình chạy nền theo lịch.
   */
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

  // Không phụ thuộc bộ lọc vì trang này LỌC NGAY TRÊN TRÌNH DUYỆT (xem `filteredTypes` bên
  // dưới) - khác với Customers.tsx gửi điều kiện lọc cho backend. Chọn cách này được vì số
  // loại xe rất ít (dăm bảy dòng), tải hết một lần rồi lọc tại chỗ thì gõ tới đâu lọc tới đó,
  // không phải chờ mạng.
  useEffect(() => { fetchData(); }, []);

  /* ══ KHỐI 3 — GHI DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /** Modal 1 — Thêm/Sửa loại xe. Giá sửa ở đây có hiệu lực NGAY LẬP TỨC. */
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

  /**
   * Xoá loại xe. Hiển thị `res.data.message` do BACKEND trả về chứ không tự viết câu thông
   * báo - vì backend có thể đã chuyển sang xoá mềm (khi loại xe còn xe đang dùng) thay vì xoá
   * hẳn, hai trường hợp cần hai câu khác nhau và chỉ backend mới biết nó đã làm gì.
   */
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

  /**
   * Modal 2 — mở form đặt lịch đổi giá, ĐIỀN SẴN giá hiện tại và ngày hôm nay.
   *
   * Điền sẵn giá cũ là có chủ đích: thường người dùng chỉ đổi một trong ba mức giá. Để trống
   * thì họ phải gõ lại cả ba, quên một ô là giá đó thành 0.
   */
  const openScheduleModal = (record: VehicleType) => {
    setScheduleTarget(record);
    scheduleForm.setFieldsValue({
      hourlyRate: record.hourlyRate,
      dailyRate: record.dailyRate,
      monthlyRate: record.monthlyRate,
      effectiveFrom: dayjs(),
    });
  };

  /**
   * Gửi lịch đổi giá -> POST /vehicle-types/:id/rate-changes.
   *
   * Lưu ý API là `rate-changes` (ghi thêm một dòng vào bảng lịch sử), KHÁC với PUT
   * /vehicle-types/:id ở handleSubmit (ghi đè giá hiện hành). Cùng là "đổi giá" nhưng hai
   * đường hoàn toàn khác nhau.
   */
  const handleScheduleSubmit = async (values: ScheduleRateChangeForm) => {
    // Chặn kỹ thuật: modal chỉ mở khi scheduleTarget khác null, nhưng TypeScript không biết
    // điều đó nên vẫn cần dòng này để truy cập `scheduleTarget.id` bên dưới.
    if (!scheduleTarget) return;
    setScheduleSubmitting(true);
    try {
      const res = await api.post(`/vehicle-types/${scheduleTarget.id}/rate-changes`, {
        hourlyRate: values.hourlyRate,
        dailyRate: values.dailyRate,
        monthlyRate: values.monthlyRate,
        // Đổi sang chuỗi ISO (chuẩn quốc tế, kèm múi giờ) trước khi gửi. Gửi nguyên đối tượng
        // dayjs hoặc chuỗi "20/09/2026" thì backend ở múi giờ khác sẽ hiểu lệch một ngày -
        // đúng thứ gây ra lỗi "giá áp dụng sớm/muộn một ngày".
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

  /**
   * Modal 3 — xem lịch sử giá. Chỉ tải khi người dùng thực sự bấm nút, không tải sẵn cho mọi
   * loại xi lúc mở trang (đa số lần vào trang không ai xem lịch sử).
   */
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

  /* ══ KHỐI 4 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  // Các cột giá dùng `align: 'right'` + `fontVariantNumeric: 'tabular-nums'`: canh phải và ép
  // mọi chữ số rộng bằng nhau, nhờ đó hàng nghìn/hàng trăm thẳng cột, mắt so sánh được nhanh.
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
          {/* `fallback` hiện một thẻ giải thích thay vì để trống: người dùng thấy nút biến mất
              sẽ tưởng hỏng, còn thấy dòng "Chỉ quản trị được sửa" thì hiểu ngay lý do. */}
          <PermissionGate screen="vehicle-types" action="update" fallback={<Tag color="default">Chỉ quản trị được sửa</Tag>}>
            <Button icon={<ClockCircleOutlined />} onClick={() => openScheduleModal(r)} size="small">Đặt lịch đổi giá</Button>
            <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">Sửa</Button>
          </PermissionGate>
          <PermissionGate screen="vehicle-types" action="delete">
            <Popconfirm title="Xác nhận xóa loại xe này?" onConfirm={() => handleDelete(r.id)} okText="Xóa" cancelText="Hủy">
              <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
            </Popconfirm>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  /* ══ KHỐI 5 — LỌC TRÊN TRÌNH DUYỆT ════════════════════════════════════════════════════
     Gõ tới đâu lọc tới đó, không gọi API. Tìm đồng thời trong tên, mô tả và CẢ BA mức giá,
     nên gõ "5000" là ra ngay các loại xe có mức giá đó.                                      */
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
      // .filter(Boolean) loại bỏ các field null/rỗng (VD mô tả để trống) trước khi so khớp.
      .filter(Boolean)
      // .some() = chỉ cần MỘT field khớp là giữ dòng đó lại.
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  return (
    <div>
      <h2 className="page-title">{t('pageVehicleTypes')}</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <PermissionGate screen="vehicle-types" action="create">
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
        {/* Đoạn giải thích ngay trong modal - đặt đúng chỗ người dùng đang phân vân, hiệu quả
            hơn viết trong tài liệu hướng dẫn mà không ai mở. */}
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
            {/* `disabledDate` khoá mọi ngày trước hôm nay: đặt lịch đổi giá cho quá khứ là vô
                nghĩa và sẽ làm sai các lượt gửi đã chốt. `.startOf('day')` để HÔM NAY vẫn chọn
                được - thiếu nó thì so cả giờ phút, và buổi chiều sẽ không chọn được hôm nay. */}
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
              // Cột trạng thái không lấy từ DB mà SUY RA tại chỗ bằng cách so ngày hiệu lực
              // với hôm nay: sau hôm nay = "Sắp áp dụng", còn lại = "Đã áp dụng". Lưu cứng
              // trạng thái vào DB thì phải có tiến trình chạy nền để lật cờ đúng ngày.
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
          // Câu thông báo khi bảng rỗng được viết lại cho có nghĩa: mặc định Ant Design chỉ
          // hiện "No data", người dùng sẽ tưởng lỗi thay vì hiểu là chưa từng đổi giá.
          locale={{ emptyText: 'Chưa có lịch sử đổi giá — giá hiện tại là giá gốc khi tạo loại xe' }}
        />
      </Modal>
    </div>
  );
};

export default VehicleTypes;
