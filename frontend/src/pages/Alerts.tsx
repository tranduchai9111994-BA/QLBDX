/**
 * Màn hình CẢNH BÁO HỆ THỐNG — gồm ba tab:
 *   1. Danh sách cảnh báo   : kết quả quét từ /api/reports/alerts (report.service.ts -> getAlerts).
 *   2. Cấu hình mức độ      : đặt ngưỡng cho từng loại cảnh báo (AlertSettingsPanel).
 *   3. Cấu hình nâng cao    : quản trị bộ luật của hệ chuyên gia (ExpertRulesPanel).
 *
 * Điểm đáng nói khi trình bày: toàn bộ ngưỡng cảnh báo là DỮ LIỆU cấu hình được, không phải câu
 * lệnh if/else viết cứng trong mã nguồn.
 *
 * ===========================================================================================
 * CẢNH BÁO ĐƯỢC SINH RA NHƯ THẾ NÀO — chuỗi ba bước:
 *
 *   1. ĐO      : backend (report.service.ts -> getAlerts) đọc dữ liệu thật và đo ra các con số
 *                — bao nhiêu xe đỗ quá lâu, khu nào lấp đầy mấy phần trăm, gói nào sắp hết hạn.
 *   2. XẾP MỨC : con số tới mức nào thì là Nguy hiểm / Cảnh báo / Thông tin do BỘ LUẬT quyết
 *                định, không phải do mã nguồn. Ba nguồn cấu hình: alertSettings.service.ts,
 *                alertRuleTier.service.ts, và hệ chuyên gia (nhóm luật 'alert').
 *   3. HIỆN    : file này chỉ nhận danh sách đã xếp mức rồi vẽ ra bảng.
 *
 * => Mã nguồn chỉ ĐO, bộ luật mới XẾP MỨC. Muốn đổi ngưỡng thì mở tab "Cấu hình nâng cao" sửa
 *    tại chỗ, không cần lập trình viên biên dịch lại. Đây là câu trả lời cho câu hỏi hay gặp
 *    nhất khi bảo vệ: "muốn đổi ngưỡng cảnh báo thì làm sao?"
 *
 * Ba tab tương ứng ba mức can thiệp, từ nông tới sâu:
 *   Tab 1 "Danh sách cảnh báo" - XEM kết quả              (file này)
 *   Tab 2 "Cấu hình mức độ"    - sửa ngưỡng đơn giản      (AlertSettingsPanel)
 *   Tab 3 "Cấu hình nâng cao"  - sửa thẳng luật suy diễn  (ExpertRulesPanel)
 * ===========================================================================================
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Select, InputNumber, Row, Col, Statistic, Space, message, Dropdown, Segmented, DatePicker, Tooltip, Tabs } from 'antd';
import {
  AlertOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FireOutlined,
  ReloadOutlined, DownloadOutlined, FileExcelOutlined, FileTextOutlined,
  CalendarOutlined, BulbOutlined, SettingOutlined, UnorderedListOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import AlertSettingsPanel from '../components/AlertSettingsPanel';
import ExpertRulesPanel from '../components/ExpertRulesPanel';
import { formatDateTime } from '../utils/dateFormat';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AlertItem } from '../types';
import { exportAlertsExcel, exportAlertsCsv } from '../utils/reportExport';
import { useLanguage } from '../context/LanguageContext';
import { defaultPagination } from '../utils/tablePagination';

type PeriodKey = 'all' | 'today' | '7days' | '30days' | 'thisMonth' | 'custom';

const { RangePicker } = DatePicker;

const Alerts: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Ngưỡng "đỗ quá lâu" là thứ DUY NHẤT gửi lên backend, vì nó đổi cách backend QUÉT dữ liệu
  // (phải truy vấn lại DB với mốc giờ mới). Ba bộ lọc còn lại chỉ cắt bớt danh sách đã có nên
  // lọc ngay trên trình duyệt — xem KHỐI 3.
  const [longParkingHours, setLongParkingHours] = useState(24);

  // --- Ba bộ lọc chỉ chạy trên trình duyệt ---
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [periodFilter, setPeriodFilter] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Quét cảnh báo. KHÔNG có bảng "Alerts" trong cơ sở dữ liệu — cảnh báo được TÍNH LẠI mỗi
   * lần gọi từ dữ liệu vận hành hiện tại.
   *
   * Vì sao không lưu vào bảng: cảnh báo phản ánh TÌNH TRẠNG chứ không phải SỰ KIỆN. Xe đỗ quá
   * lâu mà nhân viên vừa cho ra thì cảnh báo đó phải biến mất ngay; lưu vào bảng thì phải có
   * cơ chế đi dọn các dòng đã hết đúng — thừa việc mà vẫn dễ sai.
   */
  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.get<AlertItem[]>('/reports/alerts', {
        params: { longParkingHours },
      });
      setAlerts(res.data);
    } catch {
      message.error('Không tải được danh sách cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  // Chỉ phụ thuộc `longParkingHours` — đúng như giải thích ở KHỐI 1, các bộ lọc khác không
  // cần gọi lại API.
  useEffect(() => {
    fetchAlerts();
  }, [longParkingHours]);

  /* ══ KHỐI 3 — LỌC TRÊN TRÌNH DUYỆT ════════════════════════════════════════════════════ */

  /**
   * Đổi lựa chọn kỳ ("Hôm nay", "7 ngày"...) thành một khoảng [từ, đến] cụ thể.
   * Trả về null nghĩa là KHÔNG giới hạn thời gian ("Tất cả", hoặc chọn "Tùy chọn" mà chưa
   * chọn ngày) — bên dưới sẽ bỏ qua điều kiện thời gian.
   */
  const getPeriodRange = (): [Date, Date] | null => {
    const now = new Date();
    if (periodFilter === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return [start, now];
    }
    if (periodFilter === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      return [start, now];
    }
    if (periodFilter === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      return [start, now];
    }
    if (periodFilter === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return [start, now];
    }
    if (periodFilter === 'custom' && customRange) {
      // startOf('day') / endOf('day') để lấy TRỌN hai ngày đầu và cuối. Không có hai hàm này
      // thì cả hai mốc đều tính vào 0h00, và mọi cảnh báo xảy ra trong ngày cuối sẽ bị loại.
      return [customRange[0].startOf('day').toDate(), customRange[1].endOf('day').toDate()];
    }
    return null;
  };

  /**
   * Áp ba bộ lọc: mức độ VÀ loại VÀ khoảng thời gian.
   *
   * useMemo để chỉ tính lại khi thật sự cần — hàm này chạy qua toàn bộ mảng, mà component vẽ
   * lại rất nhiều lần (di chuột, mở dropdown...). Danh sách phụ thuộc phải kể đủ mọi thứ hàm
   * đọc tới; thiếu một cái là bảng không cập nhật khi đổi bộ lọc đó.
   */
  const filteredAlerts = useMemo(() => {
    const range = getPeriodRange();
    // Mẫu "trả false sớm": không khớp điều kiện nào là loại ngay, không xét tiếp.
    return alerts.filter((alert) => {
      if (severityFilter && alert.severity !== severityFilter) return false;
      if (categoryFilter && alert.category !== categoryFilter) return false;
      if (range) {
        const t = new Date(alert.occurredAt).getTime();
        if (t < range[0].getTime() || t > range[1].getTime()) return false;
      }
      return true;
    });
  }, [alerts, severityFilter, categoryFilter, periodFilter, customRange]);

  // Ba ô đếm ở đầu trang đếm trên `alerts` (TẤT CẢ), không phải `filteredAlerts` (đã lọc) —
  // cố ý: chúng là bức tranh tổng thể để người dùng biết còn bao nhiêu việc, kể cả khi đang
  // lọc xem một nhóm nhỏ. Dòng "Hiển thị X / Y cảnh báo" bên dưới mới nói về phần đã lọc.
  const dangerCount = alerts.filter((alert) => alert.severity === 'danger').length;
  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  const infoCount = alerts.filter((alert) => alert.severity === 'info').length;

  /* ══ KHỐI 4 — ĐỊNH NGHĨA CỘT BẢNG ═════════════════════════════════════════════════════ */
  const columns = [
    {
      // Ba mức độ theo thứ tự nặng dần: Thông tin (xanh) < Cảnh báo (cam) < Nguy hiểm (đỏ).
      // Mức độ do BỘ LUẬT gán ở backend, frontend chỉ đổi mã thành nhãn và màu.
      title: 'Mức độ',
      dataIndex: 'severity',
      key: 'severity',
      width: 130,
      ellipsis: true,
      render: (severity: AlertItem['severity']) => {
        if (severity === 'danger') return <Tag color="red">Nguy hiểm</Tag>;
        if (severity === 'warning') return <Tag color="orange">Cảnh báo</Tag>;
        return <Tag color="blue">Thông tin</Tag>;
      },
    },
    {
      title: 'Loại',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      ellipsis: true,
      render: (category: string) => {
        const labels: Record<string, string> = {
          parking: 'Đỗ xe',
          package: 'Gói dịch vụ',
          zone: 'Khu bãi',
          payment: 'Thanh toán',
          revenue: 'Doanh thu',
          system: 'Hệ thống',
        };
        return <Tag>{labels[category] ?? category}</Tag>;
      },
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      ellipsis: true,
      // Thẻ "Smart" đánh dấu cảnh báo do HỆ CHUYÊN GIA sinh ra, phân biệt với cảnh báo từ
      // ngưỡng cấu hình đơn giản. Nhìn vào bảng là biết ngay cái nào đi qua máy suy diễn —
      // rất tiện khi cần minh hoạ lúc bảo vệ.
      render: (title: string, record: AlertItem) => (
        <span style={{ fontWeight: 600 }}>
          {title}
          {record.smartLevel === 'rule_based' && (
            <Tag color="purple" icon={<BulbOutlined />} style={{ marginLeft: 8 }}>Smart</Tag>
          )}
        </span>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      ellipsis: true,
      render: (description: string, record: AlertItem) => (
        <div>
          <div>{description}</div>
          {/* `suggestedAction` là phần GỢI Ý HÀNH ĐỘNG do luật kèm theo. Cảnh báo chỉ nói
              "có vấn đề" thì người dùng vẫn phải tự nghĩ cách xử lý; kèm gợi ý mới thành hỗ
              trợ ra quyết định thực sự. Không phải cảnh báo nào cũng có nên phải kiểm tra. */}
          {record.suggestedAction && (
            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: 4 }}>
              💡 Gợi ý: {record.suggestedAction}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thời gian',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 180,
      ellipsis: true,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: (_: unknown, record: AlertItem) => (
        <Button size="small" onClick={() => record.relatedPath && navigate(record.relatedPath)}>
          Xem
        </Button>
      ),
    },
  ];

  /* ══ KHỐI 5 — NỘI DUNG TAB 1 ══════════════════════════════════════════════════════════
     Gán cả cây JSX vào một biến thay vì viết thẳng trong <Tabs>: phần này dài, nhét vào mảng
     `items` sẽ đẩy ba dòng khai báo tab xuống tận cuối file và không còn nhìn ra cấu trúc.   */
  const listTab = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Nguy hiểm"
              value={dangerCount}
              prefix={<FireOutlined style={{ color: 'var(--error)' }} />}
              valueStyle={{ color: 'var(--error)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Cảnh báo"
              value={warningCount}
              prefix={<ExclamationCircleOutlined style={{ color: 'var(--warning)' }} />}
              valueStyle={{ color: 'var(--warning)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Thông tin"
              value={infoCount}
              prefix={<CheckCircleOutlined style={{ color: 'var(--info)' }} />}
              valueStyle={{ color: 'var(--info)' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CalendarOutlined style={{ color: 'var(--on-surface-variant)' }} />
          {/* Chọn kỳ khác "Tùy chọn" thì XOÁ luôn khoảng ngày đã chọn. Không xoá thì người
              dùng quay lại "Tùy chọn" sẽ thấy khoảng ngày cũ còn nguyên và tưởng đang lọc
              theo nó, trong khi thực tế vừa xem kỳ khác. */}
          <Segmented
            value={periodFilter}
            onChange={(v) => { setPeriodFilter(v as PeriodKey); if (v !== 'custom') setCustomRange(null); }}
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: 'Hôm nay', value: 'today' },
              { label: '7 ngày', value: '7days' },
              { label: '30 ngày', value: '30days' },
              { label: 'Tháng này', value: 'thisMonth' },
              { label: 'Tùy chọn', value: 'custom' },
            ]}
          />
          {periodFilter === 'custom' && (
            <RangePicker
              format="DD/MM/YYYY"
              value={customRange}
              onChange={(dates) => setCustomRange(dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null)}
              style={{ width: 260 }}
            />
          )}
          {periodFilter !== 'all' && (
            <span style={{ fontSize: 12, color: 'var(--outline)' }}>
              Hiển thị {filteredAlerts.length} / {alerts.length} cảnh báo
            </span>
          )}
        </div>
        <div className="toolbar">
          <Space wrap>
            {/* Ô này KHÁC các ô lọc bên cạnh: đổi nó là gọi lại API (xem KHỐI 1). `min={1}`
                chặn nhập 0 hoặc số âm — ngưỡng 0 giờ thì mọi xe trong bãi đều thành cảnh báo. */}
            <InputNumber
              min={1}
              value={longParkingHours}
              onChange={(value) => setLongParkingHours(value ?? 24)}
              addonBefore="Xe đỗ quá"
              addonAfter="giờ"
            />
            <Select
              value={severityFilter}
              allowClear
              placeholder="Lọc mức độ"
              style={{ width: 150 }}
              onChange={setSeverityFilter}
              options={[
                { value: 'danger', label: '🔴 Nguy hiểm' },
                { value: 'warning', label: '🟠 Cảnh báo' },
                { value: 'info', label: '🔵 Thông tin' },
              ]}
            />
            <Select
              value={categoryFilter}
              allowClear
              placeholder="Lọc loại"
              style={{ width: 150 }}
              onChange={setCategoryFilter}
              // Danh sách loại được dựng TỪ CHÍNH dữ liệu đang có (Set để khử trùng lặp), không
              // viết cứng. Nhờ vậy thêm loại cảnh báo mới ở backend là ô lọc tự có thêm lựa
              // chọn, không phải sửa file này.
              options={Array.from(new Set(alerts.map((a) => a.category))).map((cat) => ({
                value: cat,
                label: { parking: 'Đỗ xe', package: 'Gói dịch vụ', zone: 'Khu bãi', payment: 'Thanh toán', system: 'Hệ thống' }[cat] ?? cat,
              }))}
            />
            <Tooltip title="Xóa bộ lọc & tải lại">
              <Button icon={<ReloadOutlined />} onClick={() => {
                setSeverityFilter(undefined);
                setCategoryFilter(undefined);
                setPeriodFilter('all');
                setCustomRange(null);
                fetchAlerts();
              }}>
                Làm mới
              </Button>
            </Tooltip>
          </Space>

          <div style={{ marginLeft: 'auto' }}>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'excel',
                    icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
                    label: 'Xuất Excel (.xlsx)',
                    // Xuất `filteredAlerts` (ĐÃ LỌC) chứ không phải `alerts`: người dùng lọc
                    // ra rồi bấm xuất thì mong file đúng phần đang xem. Chặn trước trường hợp
                    // rỗng để không tạo ra file trắng.
                    onClick: () => {
                      if (filteredAlerts.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportAlertsExcel(filteredAlerts, longParkingHours);
                      message.success(`Đã xuất ${filteredAlerts.length} cảnh báo ra Excel`);
                    },
                  },
                  {
                    key: 'csv',
                    icon: <FileTextOutlined style={{ color: 'var(--secondary)' }} />,
                    label: 'Xuất CSV',
                    onClick: () => {
                      if (filteredAlerts.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportAlertsCsv(filteredAlerts);
                      message.success(`Đã xuất ${filteredAlerts.length} cảnh báo ra CSV`);
                    },
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>
                Xuất báo cáo
              </Button>
            </Dropdown>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredAlerts}
          rowKey="id"
          loading={loading}
          pagination={defaultPagination({ pageSize: 10 })}
          // Bảng rỗng ở màn hình này là TIN TỐT (không có bất thường), nên câu thông báo viết
          // theo hướng trấn an chứ không phải kiểu báo lỗi "không có dữ liệu".
          locale={{
            emptyText: (
              <div style={{ padding: 32, color: 'var(--on-surface-variant)' }}>
                <AlertOutlined style={{ marginRight: 8 }} />
                Chưa phát hiện bất thường theo bộ lọc hiện tại
              </div>
            ),
          }}
        />
      </Card>
    </>
  );

  return (
    <div>
      <h2 className="page-title">{t('pageAlerts')}</h2>
      {/* Ba tab xếp theo mức can thiệp tăng dần (xem phần đầu file). Mặc định mở tab đầu vì
          đa số lần vào là để XEM cảnh báo, chỉnh cấu hình là việc thỉnh thoảng mới làm. */}
      <Tabs
        defaultActiveKey="list"
        items={[
          { key: 'list', label: <><UnorderedListOutlined /> Danh sách cảnh báo</>, children: listTab },
          { key: 'settings', label: <><SettingOutlined /> Cấu hình mức độ</>, children: <AlertSettingsPanel /> },
          { key: 'expert-system', label: <><ExperimentOutlined /> Cấu hình nâng cao</>, children: <ExpertRulesPanel /> },
        ]}
      />
    </div>
  );
};

export default Alerts;
