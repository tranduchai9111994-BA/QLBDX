/**
 * Màn hình KHÁCH HÀNG (chủ phương tiện).
 *
 * Khách hàng chỉ được NGỪNG HOẠT ĐỘNG chứ không xoá hẳn, vì dữ liệu gửi xe và doanh thu đều
 * tham chiếu tới khách (xem backend/src/services/customer.service.ts).
 *
 * ===========================================================================================
 * ĐÂY LÀ TRANG MẪU CHO MỌI TRANG DANH MỤC (Khách hàng / Phương tiện / Loại xe / Chỗ đỗ / Gói...).
 * Tất cả các trang đó đều dựng theo ĐÚNG 6 KHỐI dưới đây, cùng thứ tự. Hiểu một trang là đọc
 * được cả 6 trang còn lại:
 *
 *   KHỐI 1 — STATE      : dữ liệu (`customers`), cờ tải (`loading`), cờ mở modal (`modal`),
 *                         bản ghi đang sửa (`editing`), bộ lọc (`filters`), instance form.
 *   KHỐI 2 — ĐỌC (READ) : fetchCustomers() gọi GET, và useEffect kích hoạt lại khi `filters` đổi.
 *   KHỐI 3 — GHI        : handleSubmit() dùng CHUNG cho Thêm và Sửa (phân biệt bằng `editing`),
 *                         handleEdit() mở modal và đổ dữ liệu, handleDelete() ngừng hoạt động.
 *   KHỐI 4 — IMPORT     : định nghĩa cột Excel + vòng lặp gọi API từng dòng.
 *   KHỐI 5 — CỘT BẢNG   : mảng `columns` mô tả bảng, cột cuối là các nút hành động.
 *   KHỐI 6 — JSX        : tiêu đề -> nút Thêm/Nhập -> FilterBar -> Table -> các Modal.
 * ===========================================================================================
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
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  const { t } = useLanguage();                                    // hàm dịch nhãn (Việt/Anh)
  const [customers, setCustomers] = useState<Customer[]>([]);     // dữ liệu bảng
  const [loading, setLoading] = useState<boolean>(false);         // đang gọi API -> bảng xoay
  const [modal, setModal] = useState<boolean>(false);             // mở/đóng modal thêm-sửa

  // `editing` vừa giữ dữ liệu bản ghi đang sửa, VỪA LÀ CỜ phân biệt chế độ:
  //   null       -> đang THÊM mới
  //   có giá trị -> đang SỬA bản ghi đó
  // Nhờ vậy chỉ cần MỘT modal và MỘT hàm submit cho cả hai việc, thay vì nhân đôi code.
  const [editing, setEditing] = useState<Customer | null>(null);

  // Hai state cho ô tìm kiếm, KHÔNG phải một:
  //   searchInput -> chữ đang gõ, đổi theo từng ký tự (chỉ để hiện trong ô)
  //   filters     -> điều kiện đã CHỐT, chỉ đổi khi bấm Enter/nút kính lúp
  // Tách đôi để không gọi API sau mỗi ký tự vừa gõ (gõ "Nguyễn" sẽ thành 6 lần gọi API).
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });
  const [form] = Form.useForm<CustomerForm>();
  const [importOpen, setImportOpen] = useState(false);            // mở/đóng modal nhập Excel

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Gọi GET /api/customers. Việc LỌC làm ở BACKEND (gửi qua query params), không phải lọc mảng
   * trên trình duyệt — vì bãi xe chạy lâu sẽ có hàng nghìn khách, tải hết về máy khách rồi mới
   * lọc thì vừa chậm vừa tốn băng thông.
   */
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // includeInactive: true -> màn hình quản trị phải thấy CẢ khách đã ngừng hoạt động,
      // khác với các API khác trong hệ thống thường chỉ trả bản ghi đang hoạt động.
      const params: Record<string, string | boolean> = { includeInactive: true };
      // Chỉ đính param khi người dùng thực sự chọn. Gửi `search: ''` hay `isActive: undefined`
      // thì backend phải tự đoán ý nghĩa của giá trị rỗng - dễ sinh lỗi khó tìm.
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

  // Phụ thuộc `[filters]`: đổi bộ lọc là tự tải lại. Không cần gọi fetch thủ công ở từng
  // onChange của ô lọc - chỉ cần setFilters, useEffect lo phần còn lại.
  useEffect(() => { fetchCustomers(); }, [filters]);

  /* ══ KHỐI 3 — GHI DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Lưu form - dùng CHUNG cho Thêm và Sửa, phân biệt bằng `editing`:
   *   editing != null -> PUT /customers/:id   (sửa)
   *   editing == null -> POST /customers      (thêm)
   */
  const handleSubmit = async (values: CustomerForm) => {
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, values);
        message.success('Cập nhật thành công');
      } else {
        await api.post('/customers', values);
        message.success('Thêm khách hàng thành công');
      }
      // Ba dòng dọn dẹp phải đủ cả ba, và chỉ chạy KHI THÀNH CÔNG (nằm trong try, sau await):
      // đóng modal, xoá form, bỏ cờ editing. Thiếu `setEditing(null)` thì lần bấm "Thêm mới"
      // tiếp theo sẽ vô tình chạy nhánh SỬA của bản ghi cũ.
      setModal(false);
      form.resetFields();
      setEditing(null);
      // Tải lại từ server thay vì tự chèn bản ghi mới vào mảng state: server có thể đã sinh id,
      // chuẩn hoá số điện thoại, gắn ngày tạo... nên đọc lại mới chắc đúng.
      fetchCustomers();
    } catch (err) {
      // Lỗi nghiệp vụ (VD "SĐT đã tồn tại") do backend trả trong `message` -> hiện đúng câu đó
      // cho người dùng. Chỉ khi không có mới dùng câu chung chung.
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  /**
   * Mở modal ở chế độ SỬA: bật cờ `editing`, đổ dữ liệu vào form, rồi mới mở modal.
   * Chỉ đổ những field CHO PHÉP SỬA - `id`, `isActive`, ngày tạo cố ý không đưa vào form.
   */
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

  /**
   * "Xoá" mềm (soft delete). Gọi DELETE nhưng backend chỉ đặt isActive = false chứ không xoá
   * dòng khỏi DB - vì các lượt gửi xe và phiếu thu cũ đều trỏ tới khách này; xoá thật sẽ làm
   * báo cáo doanh thu năm trước mất tên khách.
   */
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

  /* ══ KHỐI 4 — NHẬP TỪ EXCEL ═══════════════════════════════════════════════════════════ */

  // Khai báo các cột file Excel. ImportModal đọc mảng này để: vẽ bảng hướng dẫn, sinh file mẫu
  // cho người dùng tải về, và khớp tên cột trong file họ nộp lên.
  const importColumns: ColumnDef[] = [
    { key: 'fullName',     label: 'Họ tên',       required: true, example: 'Nguyễn Văn A' },
    { key: 'phone',        label: 'Số điện thoại', required: true, example: '0912345678',   note: '8-15 chữ số' },
    { key: 'email',        label: 'Email',          required: false, example: 'a@mail.com' },
    { key: 'identityCard', label: 'CMND/CCCD',     required: false, example: '001234567890', note: '9-12 chữ số' },
    { key: 'address',      label: 'Địa chỉ',       required: false, example: '123 Phố Huế, Hà Nội' },
  ];

  /**
   * Nhập từng dòng Excel.
   *
   * Cố ý gọi API LẦN LƯỢT từng dòng (vòng for có await) chứ không gửi cả mảng một lần:
   *   - dòng nào lỗi thì báo đúng SỐ DÒNG đó, người dùng sửa được ngay trong file;
   *   - các dòng hợp lệ vẫn vào được, không bị một dòng sai làm hỏng cả file.
   * Đánh đổi: chậm hơn khi file lớn - chấp nhận được vì nhập dữ liệu là việc làm một lần.
   */
  const handleImport = async (rows: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // +2 để ra đúng số dòng người dùng THẤY trong Excel: mảng đếm từ 0, và dòng 1 là dòng
      // tiêu đề. Phần tử rows[0] chính là dòng 2 trên file.
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
    // Chỉ tải lại khi có ít nhất một dòng vào được - nhập thất bại toàn bộ thì bảng không đổi.
    if (success > 0) fetchCustomers();
    // Trả kết quả để ImportModal hiện bảng tổng kết "thành công N dòng, lỗi ở các dòng ...".
    return { success, errors };
  };

  /* ══ KHỐI 5 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  // Mỗi phần tử = một cột. `dataIndex` là tên field trong dữ liệu, `render` để tự vẽ ô.
  // `ellipsis: true` cắt chuỗi dài thành "..." để bảng không bị giãn ngang.
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
    // Cột hành động: không có `dataIndex` vì không lấy từ dữ liệu, chỉ vẽ nút.
    // Mỗi nút bọc trong <PermissionGate> -> nhân viên không được cấp quyền sẽ không thấy nút.
    // Nhắc lại: đây chỉ là ẩn giao diện, backend vẫn chặn độc lập bằng requirePermission.
    {
      title: t('fieldAction'), key: 'action', width: 220,
      render: (_: unknown, r: Customer) => (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PermissionGate screen="customers" action="update">
            <Button icon={<EditOutlined />} onClick={() => handleEdit(r)} size="small">{t('btnEdit')}</Button>
          </PermissionGate>
          <PermissionGate screen="customers" action="delete">
            {/* Popconfirm chèn một bước xác nhận trước khi gọi API - hành động khó hoàn tác thì
                không nên chỉ một cú bấm. `disabled={!r.isActive}` chặn bấm lại lần hai vào khách
                đã ngừng hoạt động. */}
            <Popconfirm title={t('confirmDelete')} onConfirm={() => handleDelete(r.id)}>
              <Button icon={<DeleteOutlined />} danger size="small" disabled={!r.isActive}>{t('statusInactive')}</Button>
            </Popconfirm>
          </PermissionGate>
        </div>
      ),
    },
  ];

  /* ══ KHỐI 6 — GIAO DIỆN ═══════════════════════════════════════════════════════════════
     Thứ tự: tiêu đề -> nút Nhập/Thêm -> thanh lọc -> bảng -> hai modal (nhập Excel, thêm-sửa).
     Hai modal đặt CUỐI cây JSX nhưng khi mở sẽ nổi lên trên tất cả - Ant Design tự đưa chúng
     ra cuối trang (portal), nên vị trí trong file không ảnh hưởng vị trí trên màn hình.        */
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
        {/* onChange -> cập nhật chữ đang gõ; onSearch (Enter hoặc bấm kính lúp) -> mới CHỐT
            vào `filters` và kích hoạt gọi API. Xem giải thích ở KHỐI 1. */}
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
        {/* Form chỉ chạy `onFinish` SAU KHI mọi `rules` hợp lệ. Các rules ở đây (bắt buộc,
            định dạng SĐT, định dạng CCCD) là kiểm tra SỚM cho người dùng đỡ chờ vòng đi-về;
            backend vẫn kiểm tra lại đầy đủ ở validators/, vì ai cũng có thể gọi API trực tiếp. */}
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
