/**
 * Màn hình NHẬT KÝ HOẠT ĐỘNG (chỉ admin) — ai đã thêm/sửa/xoá cái gì, lúc nào, từ IP nào.
 *
 * Dữ liệu do middleware `activityLogger` phía backend tự ghi khi có thao tác thay đổi dữ liệu,
 * kèm cả lần đăng nhập thành công và thất bại. Màn hình này chỉ đọc, không sửa được nhật ký.
 *
 * ===========================================================================================
 * ĐIỂM THIẾT KẾ ĐÁNG NÊU KHI BẢO VỆ — nhật ký được ghi ở đâu:
 *
 * KHÔNG rải lệnh ghi log vào từng controller. Chỉ cần khai báo MỘT middleware ở route:
 *     router.post('/', auth, activityLogger('vehicle'), controller.create)
 * là mọi thao tác của route đó tự được ghi lại.
 *
 * Hai chi tiết trong middlewares/activityLogger.ts đáng nhắc:
 *   - Ghi ở sự kiện `finish` (sau khi đã trả lời người dùng) -> không ai phải chờ việc ghi log.
 *   - Bỏ qua request GET và request thất bại -> bảng nhật ký không phình lên vô ích.
 *
 * Vì sao màn hình này CHỈ ĐỌC: nhật ký là bằng chứng. Cho sửa hay xoá thì nó không còn giá trị
 * đối chiếu — người làm sai chỉ việc xoá dấu vết của mình.
 *
 * Màn hình có ba phần: ba ô đếm theo mã HTTP -> thanh lọc + hai nút xuất file -> bảng nhật ký.
 * ===========================================================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, DatePicker, Select, Input, Tag, Tooltip, Button, Row, Col, Statistic, Space,
} from 'antd';
import { useLanguage } from '../context/LanguageContext';
import {
  LoginOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined,
  WarningOutlined, FileSearchOutlined, SearchOutlined, ReloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { ActivityLog, ActivityLogPage } from '../types';
import { formatDateTime } from '../utils/dateFormat';

const { RangePicker } = DatePicker;
const { Option } = Select;

// Bảng tra cấu hình hiển thị cho từng loại hành động: màu, nhãn tiếng Việt, biểu tượng.
// Gom vào một hằng số thay vì viết if/else trong hàm render — thêm loại hành động mới chỉ cần
// thêm một dòng ở đây, không phải sửa chỗ nào khác.
// Chú ý LOGIN_FAILED: đăng nhập THẤT BẠI cũng được ghi, và đó là điểm quan trọng — nhiều lần
// thất bại liên tiếp từ một IP chính là dấu hiệu có người đang dò mật khẩu.
const ACTION_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  LOGIN:        { color: 'success',   label: 'Đăng nhập',          icon: <LoginOutlined /> },
  LOGIN_FAILED: { color: 'error',     label: 'ĐN thất bại',        icon: <WarningOutlined /> },
  CREATE:       { color: 'processing',label: 'Tạo mới',            icon: <PlusCircleOutlined /> },
  UPDATE:       { color: 'warning',   label: 'Cập nhật',           icon: <EditOutlined /> },
  DELETE:       { color: 'error',     label: 'Xóa',                icon: <DeleteOutlined /> },
};

// Tên bảng trong DB -> tên nghiệp vụ tiếng Việt. Nhật ký lưu tên bảng ('ParkingRecords') vì đó
// là thứ backend biết chắc; việc dịch sang chữ người đọc hiểu là phần của giao diện.
const ENTITY_LABELS: Record<string, string> = {
  Users:            'Người dùng',
  Customers:        'Khách hàng',
  Vehicles:         'Phương tiện',
  VehicleTypes:     'Loại xe',
  ParkingZones:     'Khu bãi',
  ParkingSpots:     'Vị trí đỗ',
  ParkingPackages:  'Gói dịch vụ',
  CustomerPackages: 'Đăng ký gói',
  ParkingRecords:   'Ra vào xe',
};

const ACTIONS = ['LOGIN', 'LOGIN_FAILED', 'CREATE', 'UPDATE', 'DELETE'];
const ENTITIES = Object.keys(ENTITY_LABELS);

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  action: string | undefined;
  entity: string | undefined;
  username: string;
}

const ActivityLogs: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  const [data, setData] = useState<ActivityLog[]>([]);   // chỉ chứa dòng của TRANG hiện tại
  const { t } = useLanguage();
  // `total` = tổng số dòng khớp bộ lọc, do backend đếm. Cần cho thanh phân trang biết vẽ bao
  // nhiêu số trang — `data.length` chỉ là 20 dòng đang xem.
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    action: undefined,
    entity: undefined,
    username: '',
  });
  const [searchInput, setSearchInput] = useState('');

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Tải một trang nhật ký. TOÀN BỘ việc lọc và phân trang làm ở BACKEND — bảng nhật ký là bảng
   * lớn nhất hệ thống (ghi mỗi thao tác của mọi người dùng, tăng không ngừng), không thể tải
   * về trình duyệt rồi lọc.
   *
   * Nhận `f: Filters` qua THAM SỐ thay vì đọc thẳng state `filters`: hàm nằm trong useCallback,
   * đọc state trực tiếp sẽ dính giá trị cũ ở lần tạo hàm (bẫy "stale closure") và bảng lọc sai.
   */
  const fetchLogs = useCallback(async (currentPage: number, f: Filters) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: pageSize,
      };
      if (f.action) params.action = f.action;
      if (f.entity) params.entity = f.entity;
      if (f.username) params.username = f.username;
      if (f.dateRange) {
        // startOf/endOf để lấy TRỌN hai ngày biên; toISOString để backend và SQL Server hiểu
        // đúng mốc thời gian bất kể máy người dùng đang ở múi giờ nào.
        params.from = f.dateRange[0].startOf('day').toISOString();
        params.to = f.dateRange[1].endOf('day').toISOString();
      }
      const res = await api.get<ActivityLogPage>('/activity-logs', { params });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      // Lỗi thì xoá trắng bảng thay vì giữ dữ liệu cũ. Với màn hình đối soát, hiện dữ liệu cũ
      // mà người dùng tưởng là kết quả của bộ lọc mới thì nguy hiểm hơn là hiện bảng rỗng.
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchLogs(page, filters);
  }, [page, filters, fetchLogs]);

  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setPage(1);
    setFilters(f => ({
      ...f,
      dateRange: dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null,
    }));
  };

  const handleActionChange = (value: string | undefined) => {
    setPage(1);
    setFilters(f => ({ ...f, action: value }));
  };

  const handleEntityChange = (value: string | undefined) => {
    setPage(1);
    setFilters(f => ({ ...f, entity: value }));
  };

  /* ══ KHỐI 3 — XỬ LÝ BỘ LỌC ════════════════════════════════════════════════════════════
     Mọi hàm đổi bộ lọc đều gọi `setPage(1)` trước. Bắt buộc: đang ở trang 9 mà lọc lại, kết
     quả mới có thể chỉ còn 2 trang -> trang 9 rỗng, người dùng tưởng không có dữ liệu.       */

  /** Tìm theo tên đăng nhập. Chỉ CHỐT khi bấm nút/Enter, không gọi API theo từng ký tự gõ. */
  const handleSearch = () => {
    setPage(1);
    setFilters(f => ({ ...f, username: searchInput.trim() }));
  };

  const handleReset = () => {
    setSearchInput('');
    setPage(1);
    setFilters({ dateRange: null, action: undefined, entity: undefined, username: '' });
  };

  /* ══ KHỐI 4 — BA Ô ĐẾM THEO MÃ HTTP ═══════════════════════════════════════════════════
     Đếm trên `data` = CHỈ TRANG ĐANG XEM, không phải toàn bộ kết quả. Cần nhớ điều này khi
     đọc số: đó là "trong 20 dòng đang hiện có mấy dòng lỗi", không phải thống kê toàn kỳ.

     Phân theo mã HTTP vì mã đó cho biết ngay việc đó THÀNH CÔNG hay bị TỪ CHỐI:
       2xx = làm được   |   4xx/5xx = bị chặn hoặc lỗi   |   không có mã = bản ghi cũ
     Nhiều dòng 4xx của cùng một tài khoản là dấu hiệu họ đang cố làm việc ngoài quyền hạn.

     `!== null && !== undefined` chứ không viết gọn `d.statusCode &&`: mã 0 là giá trị hợp lệ
     về mặt kiểu, viết gọn sẽ loại nhầm.                                                      */
  const statusSuccess = data.filter(d => d.statusCode !== null && d.statusCode !== undefined && d.statusCode >= 200 && d.statusCode < 300).length;
  const statusFailed  = data.filter(d => d.statusCode !== null && d.statusCode !== undefined && d.statusCode >= 400).length;
  const statusOther   = data.filter(d => !d.statusCode).length;

  /* ══ KHỐI 5 — XUẤT FILE ═══════════════════════════════════════════════════════════════
     Hai định dạng cho hai nhu cầu: CSV nhẹ, mở được bằng mọi công cụ, hợp để nạp vào hệ thống
     khác; Excel giữ được độ rộng cột, hợp để đọc và in.

     Cả hai chỉ xuất TRANG ĐANG XEM (mảng `data`), khác với màn hình Thanh toán gọi lại API để
     lấy toàn bộ. Cần biết giới hạn này khi dùng để đối soát.                                 */

  /** Xuất CSV bằng tay, không cần thư viện. */
  const handleExportCsv = () => {
    if (!data.length) return;
    const header = ['Thời gian', 'Người dùng', 'Hành động', 'Đối tượng', 'Thực thể ID', 'IP', 'HTTP', 'Mô tả'];
    const rows = data.map(d => [
      formatDateTime(d.createdAt),
      d.username,
      ACTION_CONFIG[d.action]?.label || d.action,
      ENTITY_LABELS[d.entity || ''] || d.entity || '',
      d.entityId || '',
      d.ipAddress || '',
      d.statusCode || '',
      d.details || '',
    ]);
    // Hai xử lý bắt buộc của định dạng CSV:
    //   1. Bọc mọi ô trong dấu nháy kép, và nhân đôi dấu nháy có sẵn ("" ). Không làm thì một
    //      dấu phẩy trong phần Mô tả sẽ bị hiểu là dấu ngăn cột và cả dòng lệch hết.
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    //   2. '\uFEFF' (BOM) đặt ở đầu file: không có nó, Excel trên Windows mở file ra sẽ hiện
    //      tiếng Việt thành ký tự rác kiểu "Ngu?i dùng".
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    // Mẹo tải file phía trình duyệt: tạo một thẻ <a> ẩn, gán đường dẫn tạm rồi "bấm" bằng mã.
    const a = document.createElement('a'); a.href = url; a.download = `activity-logs-${dayjs().format('YYYYMMDD')}.csv`; a.click();
    // Thu hồi đường dẫn tạm sau khi dùng xong, nếu không dữ liệu file vẫn nằm trong bộ nhớ
    // trình duyệt cho tới khi đóng tab (rò rỉ bộ nhớ nếu xuất nhiều lần).
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!data.length) return;
    const headers = ['Thời gian', 'Người dùng', 'Họ tên', 'Hành động', 'Đối tượng', 'Thực thể ID', 'IP', 'HTTP Status', 'Nội dung'];
    const rows = data.map(d => [
      formatDateTime(d.createdAt),
      d.username,
      d.user?.fullName || '',
      ACTION_CONFIG[d.action]?.label || d.action,
      ENTITY_LABELS[d.entity || ''] || d.entity || '',
      d.entityId || '',
      d.ipAddress || '',
      d.statusCode != null ? d.statusCode : '',
      d.details || '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Tự tính độ rộng từng cột = độ dài lớn nhất giữa tiêu đề và mọi ô trong cột đó. Không có
    // đoạn này thì Excel để mọi cột rộng bằng nhau và cột Nội dung bị cắt cụt thành "###".
    ws['!cols'] = headers.map((h, i) => ({
      wch: Math.max(h.length + 2, ...rows.map(r => String(r[i] ?? '').length + 1)),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhật ký hoạt động');
    XLSX.writeFile(wb, `activity-logs-${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  /* ══ KHỐI 6 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  const columns: ColumnsType<ActivityLog> = [
    {
      title: t('colTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      ellipsis: true,
      render: (v: string) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}>
          {formatDateTime(v)}
        </span>
      ),
    },
    {
      title: t('colUser'),
      key: 'user',
      width: 170,
      ellipsis: true,
      render: (_: unknown, record: ActivityLog) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{record.username}</div>
          {record.user?.fullName && (
            <div style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)' }}>
              {record.user.fullName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 130,
      render: (action: string) => {
        const cfg = ACTION_CONFIG[action];
        if (!cfg) return <Tag>{action}</Tag>;
        return (
          <Tag color={cfg.color} icon={cfg.icon} style={{ fontWeight: 600 }}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 180,
      render: (_: unknown, record: ActivityLog) => {
        if (!record.entity) return <span style={{ color: 'var(--outline)' }}>—</span>;
        const label = ENTITY_LABELS[record.entity] ?? record.entity;
        return (
          <span>
            <Tag style={{ marginRight: 4 }}>{label}</Tag>
            {record.entityId && (
              <span style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)' }}>
                #{record.entityId}
              </span>
            )}
          </span>
        );
      },
    },
    {
      title: 'Chi tiết',
      dataIndex: 'details',
      key: 'details',
      width: 280,
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ fontSize: '0.82rem', color: 'var(--on-surface-variant)' }}>
              <FileSearchOutlined style={{ marginRight: 4 }} />{v}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--outline)' }}>—</span>
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 120,
      ellipsis: true,
      render: (v: string | null) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--on-surface-variant)' }}>
          {v ?? '—'}
        </span>
      ),
    },
    {
      title: 'HTTP',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 100,
      align: 'center',
      // Hiện thẳng mã HTTP thay vì dịch thành chữ: mã là thứ đối chiếu được với log của server
      // khi cần điều tra sự cố. Màu để liếc nhanh: <300 xanh, <400 vàng, còn lại đỏ.
      // Bản ghi cũ chưa có mã thì hiện gạch ngang, không hiện số 0 gây hiểu nhầm.
      render: (code: number | null) => {
        if (!code) return <span style={{ color: 'var(--outline)' }}>—</span>;
        const color = code < 300 ? 'success' : code < 400 ? 'warning' : 'error';
        return <Tag color={color}>{code}</Tag>;
      },
    },
  ];

  return (
    <div>
      <h2 className="page-title">{t('pageActivityLogs')}</h2>

      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: 'var(--success-container)', border: 'none' }}>
            <Statistic
              title={
                <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.78rem' }}>
                  HTTP 2xx — THÀNH CÔNG
                </span>
              }
              value={statusSuccess}
              suffix={
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--success)' }}>
                  &nbsp;yêu cầu
                </span>
              }
              valueStyle={{ color: 'var(--success)', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: 'var(--error-container)', border: 'none' }}>
            <Statistic
              title={
                <span style={{ color: 'var(--error)', fontWeight: 600, fontSize: '0.78rem' }}>
                  HTTP 4xx/5xx — THẤT BẠI
                </span>
              }
              value={statusFailed}
              suffix={
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--error)' }}>
                  &nbsp;yêu cầu
                </span>
              }
              valueStyle={{ color: 'var(--error)', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: 'var(--surface-container)', border: 'none' }}>
            <Statistic
              title={
                <span style={{ color: 'var(--on-surface-variant)', fontWeight: 600, fontSize: '0.78rem' }}>
                  KHÔNG CÓ STATUS CODE
                </span>
              }
              value={statusOther}
              suffix={
                <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--on-surface-variant)' }}>
                  &nbsp;yêu cầu
                </span>
              }
              valueStyle={{ color: 'var(--on-surface-variant)', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={7}>
            <RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              value={filters.dateRange}
              onChange={handleDateChange}
              placeholder={['Từ ngày', 'Đến ngày']}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Hành động"
              allowClear
              value={filters.action}
              onChange={handleActionChange}
            >
              {ACTIONS.map(a => (
                <Option key={a} value={a}>
                  {ACTION_CONFIG[a]?.label ?? a}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Đối tượng"
              allowClear
              value={filters.entity}
              onChange={handleEntityChange}
            >
              {ENTITIES.map(e => (
                <Option key={e} value={e}>{ENTITY_LABELS[e]}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={16} sm={8} md={5}>
            <Input
              placeholder="Tên đăng nhập..."
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={8} sm={4} md={4} style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              {t('btnSearch')}
            </Button>
            <Tooltip title={t('btnReset')}>
              <Button icon={<ReloadOutlined />} onClick={handleReset} />
            </Tooltip>
          </Col>
          <Col xs={24} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space>
              <Button onClick={handleExportCsv}>{t('btnExport')} CSV</Button>
              <Button
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
              >
                Xuất Excel
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card size="small">
        <Table<ActivityLog>
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1140 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '30', '50', '100'],
            showQuickJumper: true,
            showTotal: (t) => `Tổng ${t} bản ghi`,
            onChange: (p, ps) => {
              if (ps !== pageSize) { setPageSize(ps); setPage(1); }
              else setPage(p);
            },
          }}
          rowClassName={(record) =>
            record.action === 'LOGIN_FAILED' ? 'ant-table-row-danger' : ''
          }
        />
      </Card>
    </div>
  );
};

export default ActivityLogs;
