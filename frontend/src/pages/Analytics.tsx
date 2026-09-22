/**
 * Màn hình PHÂN TÍCH (chỉ admin) — hệ hỗ trợ ra quyết định.
 *
 * Gọi /api/analytics/insights; backend đo các chỉ số vận hành rồi đưa qua hệ chuyên gia (nhóm luật
 * 'analytics') để sinh ra nhận định kèm LỜI GIẢI THÍCH vì sao có kết luận đó.
 * Khác với màn hình Báo cáo vốn chỉ hiển thị số liệu thô.
 *
 * PHÂN BIỆT BA MÀN HÌNH DỄ NHẦM (câu hỏi rất hay gặp khi bảo vệ):
 *   Tổng quan (Dashboard) - số liệu ĐANG DIỄN RA ngay lúc này.
 *   Báo cáo   (Reports)   - số liệu QUÁ KHỨ dựng thành biểu đồ. Người đọc tự rút kết luận.
 *   Phân tích (file này)  - hệ thống ĐỌC số liệu rồi ĐỀ XUẤT HÀNH ĐỘNG kèm lý do. Đây là
 *                           "hỗ trợ ra quyết định" (DSS - Decision Support System).
 *
 * Điểm đáng nhấn: mục "Gợi ý quyết định" ở cuối trang không phải câu viết cứng trong code.
 * Backend đo dữ kiện thật (tỷ lệ lấp đầy, doanh thu/chỗ...) rồi đưa qua MÁY SUY DIỄN của hệ
 * chuyên gia với nhóm luật 'analytics'; mỗi gợi ý trả về kèm `analysis` giải thích vì sao.
 * Đây chính là tính GIẢI THÍCH ĐƯỢC (explainability) - thứ phân biệt hệ chuyên gia với mô
 * hình học máy hộp đen.
 *
 * Trang này CHỈ ĐỌC: không có nút thêm/sửa/xoá nên không có modal, không có form.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Segmented, Table, Progress, Collapse, Tag, message, Spin, Empty } from 'antd';
import { BulbOutlined, WarningOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import api from '../api/axios';
import { AnalyticsInsights } from '../types';
import PageHeader from '../components/PageHeader';
import { chartColor } from '../utils/chartTheme';

type PeriodKey = 'month' | 'quarter' | 'year';

/** Định dạng số kiểu Việt Nam. `v || 0` chặn undefined/null để không hiện chữ "NaN" trên biểu đồ. */
const fmt = (v: number) => Number(v || 0).toLocaleString('vi-VN');

const Analytics: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  const [period, setPeriod] = useState<PeriodKey>('month');   // kỳ phân tích: tháng/quý/năm
  const [data, setData] = useState<AnalyticsInsights | null>(null);
  const [loading, setLoading] = useState(true);               // true ngay từ đầu: vừa mở là đang tải

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════
     Toàn bộ trang chỉ gọi MỘT API. Backend gom sẵn cả bốn phần (theo ngày trong tuần, theo
     giờ, theo khu vực, gợi ý quyết định) vào một phản hồi, thay vì bắt frontend gọi bốn lần
     rồi tự ghép - việc tổng hợp thuộc về nghiệp vụ, nên để ở service của backend.            */
  useEffect(() => {
    setLoading(true);
    api.get<AnalyticsInsights>('/analytics/insights', { params: { period } })
      .then((res) => setData(res.data))
      .catch(() => message.error('Không tải được dữ liệu phân tích'))
      .finally(() => setLoading(false));
    // Đổi kỳ -> gọi lại API. Không lọc tại chỗ được vì mỗi kỳ là một phép tổng hợp khác nhau
    // trên dữ liệu thô nằm ở DB.
  }, [period]);

  /* ══ KHỐI 3 — CỘT BẢNG HIỆU QUẢ THEO KHU VỰC ══════════════════════════════════════════ */

  // useMemo với mảng phụ thuộc rỗng: định nghĩa cột không phụ thuộc state nào, nên tạo đúng
  // MỘT LẦN rồi dùng lại. Không có useMemo thì mỗi lần trang vẽ lại sẽ sinh mảng mới, Table
  // tưởng cột đã đổi và vẽ lại toàn bộ.
  const zoneColumns = useMemo(() => [
    { title: 'Khu vực', dataIndex: 'zone', key: 'zone', width: 140, ellipsis: true },
    { title: 'Tổng chỗ', dataIndex: 'totalSpots', key: 'totalSpots', width: 90 },
    {
      title: 'Tỷ lệ lấp đầy', dataIndex: 'avgOccupancy', key: 'avgOccupancy', width: 200,
      // Thanh tiến trình ĐỔI MÀU theo mức lấp đầy: >=80% đỏ (quá tải), >=60% vàng, còn lại
      // xanh. Màu giúp nhìn lướt là thấy khu nào có vấn đề, không phải đọc từng con số.
      render: (v: number) => (
        <Progress
          percent={v}
          size="small"
          strokeColor={v >= 80 ? 'var(--error)' : v >= 60 ? 'var(--warning)' : 'var(--success)'}
        />
      ),
    },
    {
      title: 'Doanh thu', dataIndex: 'revenue', key: 'revenue', width: 150, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}đ</span>,
    },
    {
      // "Doanh thu trên mỗi chỗ" mới là chỉ số so sánh được giữa các khu. Doanh thu tuyệt đối
      // thì khu nhiều chỗ luôn thắng, không nói lên khu nào khai thác hiệu quả hơn.
      title: 'DT/chỗ', dataIndex: 'revenuePerSpot', key: 'revenuePerSpot', width: 150, align: 'right' as const,
      render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}đ</span>,
    },
  ], []);

  // Lần tải ĐẦU TIÊN (chưa có data) -> hiện vòng xoay toàn trang.
  // Các lần sau (đổi kỳ) KHÔNG dùng nhánh này mà bọc <Spin spinning> quanh nội dung cũ, để
  // màn hình không nhấp nháy trắng - người dùng vẫn thấy dữ liệu cũ mờ đi trong lúc chờ.
  if (loading && !data) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <PageHeader />

      <Card style={{ marginBottom: 16 }}>
        <Segmented
          value={period}
          onChange={(v) => setPeriod(v as PeriodKey)}
          options={[
            { label: 'Tháng gần nhất', value: 'month' },
            { label: 'Quý gần nhất', value: 'quarter' },
            { label: 'Năm gần nhất', value: 'year' },
          ]}
        />
      </Card>

      {!data ? (
        <Empty description="Chưa có dữ liệu" />
      ) : (
        <Spin spinning={loading}>
          <Row gutter={[14, 14]}>
            {/* `xs={24} lg={12}`: màn hình nhỏ thì mỗi biểu đồ chiếm trọn chiều ngang (24/24),
                màn hình lớn thì hai biểu đồ nằm cạnh nhau (12/24 mỗi cái). */}
            <Col xs={24} lg={12}>
              <Card title="Lượt xe theo ngày trong tuần">
                {/* ResponsiveContainer đo chiều rộng thật của thẻ Card rồi mới vẽ - nhờ đó biểu
                    đồ co giãn theo cửa sổ. Đặt chiều cao cố định (280) vì container không tự
                    suy ra được chiều cao, để trống thì biểu đồ cao 0 và không hiện gì. */}
                <ResponsiveContainer width="100%" height={280}>
                  {/* Biểu đồ CỘT cho ngày trong tuần: bảy giá trị rời rạc, không liên tục. */}
                  <BarChart data={data.dayOfWeekAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ReTooltip formatter={(v: number, name: string) => name === 'avgVehicles' ? [v, 'Lượt xe TB'] : [`${fmt(v)}đ`, 'Doanh thu TB']} />
                    <Bar dataKey="avgVehicles" fill={chartColor.primary()} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Lượt xe theo giờ trong ngày">
                <ResponsiveContainer width="100%" height={280}>
                  {/* Biểu đồ ĐƯỜNG cho khung giờ: thời gian liên tục, đường nối làm nổi rõ
                      giờ cao điểm - thứ dùng để quyết định xếp ca trực. */}
                  <LineChart data={data.hourlyAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} />
                    <YAxis />
                    <ReTooltip labelFormatter={(h) => `${h}h`} formatter={(v: number) => [v, 'Lượt xe TB']} />
                    <Line type="monotone" dataKey="avgVehicles" stroke={chartColor.success()} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Card title="Hiệu quả theo khu vực" style={{ marginTop: 14 }}>
            <Table columns={zoneColumns} dataSource={data.zoneEfficiency} rowKey="zone" pagination={false} size="small" />
          </Card>

          {/* Hiệu quả THỰC ĐO của thuật toán gợi ý chỗ đỗ.
              Ô chọn chỗ ở màn Xe vào chỉ được điền sẵn chứ không khoá, nhân viên đổi tuỳ ý — nên
              tỷ lệ họ giữ nguyên gợi ý chính là đánh giá của người dùng thật cho thuật toán. */}
          <Card
            title={<span>🎯 Hiệu quả thuật toán gợi ý chỗ đỗ <Tag color="blue">SAW</Tag></span>}
            style={{ marginTop: 14 }}
          >
            {data.algorithmEffectiveness.acceptanceRate === null ? (
              // Phân biệt rõ "chưa có dữ liệu" với "0% chấp nhận" — hai chuyện khác hẳn nhau.
              // Chỉ số này chỉ đo được từ lúc tính năng ghi lại gợi ý được cài, dữ liệu lịch sử
              // cũ không có nên không tính vào.
              <Empty
                description={
                  <span>
                    Kỳ này chưa có lượt xe vào nào kèm gợi ý để tính.
                    <br />
                    <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                      Chỉ số đo từ lúc bật tính năng ghi nhận gợi ý trở đi — các lượt đỗ trước đó
                      không lưu lại chỗ hệ thống đã gợi ý nên không tính được.
                    </span>
                  </span>
                }
              />
            ) : (
              <Row gutter={[24, 16]} align="middle">
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'center' }}>
                    <Progress
                      type="dashboard"
                      percent={data.algorithmEffectiveness.acceptanceRate}
                      strokeColor={
                        data.algorithmEffectiveness.acceptanceRate >= 70
                          ? 'var(--success, #52c41a)'
                          : data.algorithmEffectiveness.acceptanceRate >= 40
                            ? 'var(--warning, #faad14)'
                            : 'var(--error, #ff4d4f)'
                      }
                    />
                    <div style={{ fontWeight: 600, marginTop: 8 }}>Tỷ lệ chấp nhận gợi ý</div>
                  </div>
                </Col>
                <Col xs={24} md={16}>
                  {/* Không dùng class info-row/info-label: trong design-system.css chúng chỉ có
                      tác dụng bên trong .info-panel, đặt ở đây nhãn và giá trị sẽ dính vào nhau. */}
                  {[
                    { label: 'Thuật toán', value: data.algorithmEffectiveness.algorithm },
                    { label: 'Số lượt có gợi ý (mẫu)', value: data.algorithmEffectiveness.sampleSize },
                    { label: 'Nhân viên giữ nguyên gợi ý', value: data.algorithmEffectiveness.acceptedCount },
                    { label: 'Nhân viên tự chọn chỗ khác', value: data.algorithmEffectiveness.overriddenCount },
                  ].map((row) => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '8px 0',
                        borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.06))',
                      }}
                    >
                      <span style={{ color: 'var(--on-surface-variant)' }}>{row.label}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', marginTop: 12, marginBottom: 0 }}>
                    Nhân viên tại quầy nắm rõ thực tế bãi nhất và được quyền đổi chỗ tuỳ ý, nên tỷ
                    lệ họ giữ nguyên gợi ý phản ánh trực tiếp mức độ sát thực tế của thuật toán.
                    Tỷ lệ thấp là dấu hiệu nên xem lại trọng số 5 tiêu chí ở màn Cảnh báo → Cấu
                    hình nâng cao.
                    {data.algorithmEffectiveness.sampleSize < 30 && (
                      <>
                        {' '}
                        <b>
                          Mẫu hiện còn nhỏ ({data.algorithmEffectiveness.sampleSize} lượt) — con số
                          chưa đủ tin cậy để kết luận.
                        </b>
                      </>
                    )}
                  </p>
                </Col>
              </Row>
            )}
          </Card>

          <Card
            title={<span><BulbOutlined style={{ color: 'var(--warning)' }} /> Gợi ý quyết định <Tag color="purple">DSS</Tag></span>}
            style={{ marginTop: 14 }}
          >
            {/* Danh sách gợi ý quyết định do HỆ CHUYÊN GIA sinh ra. Rỗng KHÔNG phải là lỗi -
                nghĩa là không luật nào cháy, tức vận hành đang bình thường. */}
            {data.decisions.length === 0 ? (
              <Empty description="Chưa có gợi ý quyết định nào trong kỳ này — vận hành ổn định" />
            ) : (
              <Collapse
                defaultActiveKey={data.decisions.map((d) => d.id)}
                items={data.decisions.map((d) => ({
                  key: d.id,
                  label: <span style={{ fontWeight: 600 }}><WarningOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />{d.question}</span>,
                  children: (
                    <div>
                      <p style={{ color: 'var(--on-surface-variant)', marginBottom: 16 }}>{d.analysis}</p>
                      <Table
                        pagination={false}
                        size="small"
                        rowKey="action"
                        dataSource={d.options}
                        // Mỗi gợi ý nêu NHIỀU phương án kèm tác động và rủi ro, chứ không ra
                        // lệnh một đáp án duy nhất. Đúng tinh thần "hỗ trợ ra quyết định":
                        // máy bày đủ lựa chọn, người quản lý mới là người chọn.
                        columns={[
                          { title: 'Phương án', dataIndex: 'action', key: 'action', width: '30%' },
                          { title: 'Tác động dự kiến', dataIndex: 'estimatedImpact', key: 'estimatedImpact' },
                          { title: 'Rủi ro', dataIndex: 'risk', key: 'risk' },
                        ]}
                      />
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Spin>
      )}
    </div>
  );
};

export default Analytics;
