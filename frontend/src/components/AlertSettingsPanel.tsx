/**
 * Bảng cấu hình CẢNH BÁO (tab "Cấu hình mức độ" trong màn hình Cảnh báo).
 *
 * Cho phép người quản trị đặt các mốc ngưỡng và mức độ tương ứng (Nguy hiểm / Cảnh báo / Thông tin)
 * cho từng loại cảnh báo — thay cho việc sửa ngưỡng trong mã nguồn rồi biên dịch lại.
 * Dữ liệu lưu ở /api/alert-rule-tiers và /api/alert-settings, được report.service.ts đọc khi quét.
 *
 * ===========================================================================================
 * ĐÂY LÀ MINH CHỨNG CHO CÂU "NGƯỠNG LÀ DỮ LIỆU, KHÔNG PHẢI CODE".
 *
 * Cách làm thông thường (và là thứ cần tránh) sẽ là viết thẳng trong service:
 *       if (hours >= 48) severity = 'danger';
 *       else if (hours >= 24) severity = 'warning';
 * Muốn đổi 48 thành 36 thì phải sửa mã nguồn, biên dịch lại, triển khai lại.
 *
 * Ở đây các mốc đó nằm trong BẢNG DỮ LIỆU (AlertRuleTiers). Quản trị viên thêm/sửa/xoá mốc
 * ngay trên giao diện này và lần quét cảnh báo kế tiếp đã dùng ngưỡng mới.
 *
 * Panel gồm HAI phần, đừng nhầm:
 *   PHẦN 1 - "Tham số phụ" (bảng AlertSettings): vài giá trị ĐƠN LẺ, mỗi thứ chỉ một giá trị.
 *            VD "khu đã đầy thì xếp mức độ gì" — tình huống nhị phân, không có nhiều mốc.
 *   PHẦN 2 - "Bảng ngưỡng" (bảng AlertRuleTiers): NHIỀU MỐC cho cùng một loại cảnh báo.
 *            VD Xe đỗ quá lâu:  >=48h Nguy hiểm | >=24h Cảnh báo | >=12h Thông tin.
 *
 * Quan hệ với hệ chuyên gia: mỗi mốc ở phần 2 tương ứng một luật thuộc nhóm 'alert'. Tắt công
 * tắc "Đang dùng" = đặt luật đó enabled = false, máy suy diễn sẽ bỏ qua nó.
 * Tab "Cấu hình nâng cao" bên cạnh (ExpertRulesPanel) cho sửa thẳng luật ở dạng đầy đủ; panel
 * này là bản rút gọn, dễ dùng hơn cho công việc hằng ngày.
 * ===========================================================================================
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Form, InputNumber, Select, Button, Row, Col, message, Divider, Alert,
  Table, Tag, Space, Modal, Dropdown, Switch, Tooltip,
} from 'antd';
import { SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';
import api from '../api/axios';
import { confirmDanger } from '../utils/confirmDanger';
import { exportAlertTiersExcel, exportAlertTiersCsv } from '../utils/reportExport';

interface GateSettingsForm {
  zoneNearFullAvailable: number;
  zoneImbalanceMinPercent: number;
  parkingAnomalyMinMinutes: number;
  suspiciousPaymentParkingAmount: number;
  zoneFullSeverity: string;
}

/**
 * Mô tả một LOẠI cảnh báo, do backend cung cấp qua /alert-rule-tiers/rule-types.
 *
 * Lấy từ server chứ không viết cứng ở frontend, để thêm loại cảnh báo mới chỉ cần khai báo ở
 * backend — giao diện tự có thêm lựa chọn, không phải sửa file này.
 *
 * `comparator` cho biết ngưỡng so theo chiều nào:
 *   'gte' - lớn hơn hoặc bằng thì cảnh báo (VD: đỗ quá nhiều giờ)
 *   'lte' - nhỏ hơn hoặc bằng thì cảnh báo (VD: còn quá ít chỗ trống)
 * Cùng một con số nhưng hai chiều so cho ý nghĩa ngược nhau, nên phải đi kèm.
 */
interface RuleTypeMeta {
  value: string;
  label: string;
  unit: string;                  // đơn vị hiện sau con số: "giờ", "chỗ", "%"...
  comparator: 'gte' | 'lte';
}

/**
 * MỘT MỐC NGƯỠNG — đơn vị cấu hình nhỏ nhất của phần 2.
 * Đọc một dòng theo mẫu:  NẾU <ruleType> vượt <threshold> THÌ mức độ là <severity>.
 * Nhiều dòng cùng `ruleType` với `threshold` khác nhau tạo thành thang mức độ nhiều bậc.
 */
interface RuleTier {
  id: number;
  ruleType: string;     // loại cảnh báo (khớp với RuleTypeMeta.value)
  threshold: number;    // con số ngưỡng
  severity: string;     // danger | warning | info
  enabled: boolean;     // tắt = máy suy diễn bỏ qua mốc này
}

const SEVERITY_OPTIONS = [
  { value: 'danger', label: '🔴 Nguy hiểm' },
  { value: 'warning', label: '🟠 Cảnh báo' },
  { value: 'info', label: '🔵 Thông tin' },
];

// Ba bảng tra dùng chung cho ô chọn, thẻ màu và câu thông báo. Gom vào hằng số để ba nơi không
// bao giờ hiện lệch nhau (chỗ ghi "Nguy hiểm", chỗ ghi "Nghiêm trọng").
const SEVERITY_COLOR: Record<string, string> = { danger: 'red', warning: 'orange', info: 'blue' };
const SEVERITY_LABEL: Record<string, string> = { danger: 'Nguy hiểm', warning: 'Cảnh báo', info: 'Thông tin' };

/**
 * Cấu hình cảnh báo gồm 2 phần:
 * 1) Tham số phụ — vài giá trị đơn (VD: khu đã đầy = mức độ gì).
 * 2) Bảng ngưỡng nhiều mốc theo loại cảnh báo — admin tự thêm/sửa/xoá mốc (VD: Xe đỗ quá lâu:
 *    >=48h = Nguy hiểm, >=24h = Cảnh báo, >=12h = Thông tin), lọc được theo loại/mức độ.
 */
const AlertSettingsPanel: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════
     Chia làm hai cụm rõ rệt, khớp với hai phần của panel.                                    */

  // --- Cụm PHẦN 1: tham số phụ ---
  const [gateForm] = Form.useForm<GateSettingsForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Cụm PHẦN 2: bảng ngưỡng nhiều mốc ---
  const [ruleTypes, setRuleTypes] = useState<RuleTypeMeta[]>([]);
  const [tiers, setTiers] = useState<RuleTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [filterRuleType, setFilterRuleType] = useState<string | undefined>();
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>();

  // Gộp cờ mở modal và bản ghi đang sửa vào MỘT object thay vì hai state riêng: hai giá trị
  // này luôn đổi cùng lúc, tách ra thì dễ quên cập nhật một cái và modal mở ở trạng thái sai.
  const [tierModal, setTierModal] = useState<{ open: boolean; editing: RuleTier | null }>({ open: false, editing: null });
  const [tierForm] = Form.useForm<{ ruleType: string; threshold: number; severity: string }>();
  const [tierSaving, setTierSaving] = useState(false);

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════
     Ba API riêng cho ba loại dữ liệu khác nhau, không gộp được:
       /alert-settings              - tham số phụ (phần 1)
       /alert-rule-tiers            - các mốc ngưỡng (phần 2), tải lại khi đổi bộ lọc
       /alert-rule-tiers/rule-types - danh mục loại cảnh báo, tải một lần               */

  /** Tải tham số phụ rồi đổ thẳng vào form. */
  const fetchGateSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get<GateSettingsForm>('/alert-settings');
      gateForm.setFieldsValue(res.data);
    } catch {
      message.error('Không tải được cấu hình cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  const fetchTiers = async () => {
    setTiersLoading(true);
    try {
      const res = await api.get<RuleTier[]>('/alert-rule-tiers', {
        params: { ruleType: filterRuleType, severity: filterSeverity },
      });
      setTiers(res.data);
    } catch {
      message.error('Không tải được bảng ngưỡng cảnh báo');
    } finally {
      setTiersLoading(false);
    }
  };

  const fetchRuleTypes = async () => {
    try {
      const res = await api.get<RuleTypeMeta[]>('/alert-rule-tiers/rule-types');
      setRuleTypes(res.data);
    } catch {
      message.error('Không tải được danh sách loại cảnh báo');
    }
  };

  // Hai useEffect tách biệt vì hai nhịp khác nhau: cái trên chạy MỘT LẦN lúc mở panel, cái
  // dưới chạy lại mỗi khi đổi bộ lọc. Gộp chung thì mỗi lần lọc sẽ tải lại cả những dữ liệu
  // không đổi.
  useEffect(() => { fetchGateSettings(); fetchRuleTypes(); }, []);
  useEffect(() => { fetchTiers(); }, [filterRuleType, filterSeverity]);

  // Hai hàm tra nhãn và đơn vị từ mã loại cảnh báo. `|| value` / `|| ''` là lưới an toàn: danh
  // mục có thể chưa tải xong khi bảng vẽ lần đầu — lúc đó hiện mã gốc còn hơn hiện "undefined".
  const ruleTypeLabel = (value: string) => ruleTypes.find((r) => r.value === value)?.label || value;
  const ruleTypeUnit = (value: string) => ruleTypes.find((r) => r.value === value)?.unit || '';

  const handleSaveGates = async (values: GateSettingsForm) => {
    setSaving(true);
    try {
      await api.put('/alert-settings', values);
      message.success('Đã lưu tham số phụ');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không lưu được cấu hình');
    } finally {
      setSaving(false);
    }
  };

  /* ══ KHỐI 3 — THÊM / SỬA / TẮT / XOÁ MỐC NGƯỠNG ═══════════════════════════════════════ */

  const openAddTier = () => {
    tierForm.resetFields();
    setTierModal({ open: true, editing: null });
  };

  const openEditTier = (tier: RuleTier) => {
    tierForm.setFieldsValue({ ruleType: tier.ruleType, threshold: tier.threshold, severity: tier.severity });
    setTierModal({ open: true, editing: tier });
  };

  const handleSaveTier = async (values: { ruleType: string; threshold: number; severity: string }) => {
    setTierSaving(true);
    try {
      if (tierModal.editing) {
        await api.put(`/alert-rule-tiers/${tierModal.editing.id}`, values);
        message.success('Đã cập nhật mốc ngưỡng');
      } else {
        await api.post('/alert-rule-tiers', values);
        message.success('Đã thêm mốc ngưỡng');
      }
      setTierModal({ open: false, editing: null });
      fetchTiers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không lưu được mốc ngưỡng');
    } finally {
      setTierSaving(false);
    }
  };

  /**
   * TẮT / BẬT một mốc — thao tác an toàn hơn xoá.
   *
   * Tắt = đặt luật tương ứng (nhóm 'alert') enabled = false, máy suy diễn bỏ qua nó và cảnh
   * báo đó ngừng phát. Nhưng CẤU HÌNH VẪN CÒN, bật lại là chạy tiếp.
   *
   * Vì sao cần cả tắt lẫn xoá: khi muốn thử "tắt cảnh báo này xem có bớt nhiễu không", tắt rồi
   * bật lại mất hai cú bấm; còn xoá thì phải nhớ lại con số ngưỡng cũ để gõ lại.
   */
  const handleToggleTier = async (tier: RuleTier, enabled: boolean) => {
    try {
      // Gửi lại ĐẦY ĐỦ các field cũ kèm `enabled` mới, vì API là PUT (thay thế cả bản ghi)
      // chứ không phải PATCH. Gửi mỗi `enabled` sẽ xoá trắng ngưỡng và mức độ.
      await api.put(`/alert-rule-tiers/${tier.id}`, {
        ruleType: tier.ruleType,
        threshold: tier.threshold,
        severity: tier.severity,
        enabled,
      });
      message.success(enabled ? 'Đã bật mốc ngưỡng' : 'Đã tắt mốc ngưỡng — cảnh báo này sẽ không phát nữa');
      fetchTiers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không đổi được trạng thái mốc ngưỡng');
    }
  };

  /**
   * Xoá hẳn một mốc. Câu xác nhận ghi ĐẦY ĐỦ nội dung mốc sắp xoá ("Xe đỗ quá lâu 24 giờ ->
   * Cảnh báo") thay vì hỏi chung chung "Bạn có chắc không?" — người dùng đọc là biết ngay mình
   * có đang bấm nhầm dòng hay không.
   */
  const handleDeleteTier = (tier: RuleTier) => {
    confirmDanger({
      title: 'Xác nhận xóa mốc ngưỡng',
      content: `Xóa mốc "${ruleTypeLabel(tier.ruleType)} ${tier.threshold}${ruleTypeUnit(tier.ruleType)} → ${SEVERITY_LABEL[tier.severity]}"?`,
      successMessage: 'Đã xóa mốc ngưỡng',
      onConfirm: async () => {
        await api.delete(`/alert-rule-tiers/${tier.id}`);
        fetchTiers();
      },
    });
  };

  /* ══ KHỐI 4 — ĐỊNH NGHĨA CỘT BẢNG NGƯỠNG ══════════════════════════════════════════════
     Phụ thuộc `ruleTypes` vì hai hàm tra nhãn/đơn vị đọc từ đó — danh mục tải xong thì cột
     phải được dựng lại, nếu không bảng sẽ mãi hiện mã thay vì nhãn tiếng Việt.               */
  const columns = useMemo(() => [
    {
      title: 'Loại cảnh báo', dataIndex: 'ruleType', key: 'ruleType',
      render: (v: string) => ruleTypeLabel(v),
    },
    {
      title: 'Ngưỡng', key: 'threshold',
      render: (_: unknown, r: RuleTier) => (
        // Mốc đã tắt bị làm MỜ (opacity 0.45) thay vì ẩn đi: vẫn thấy được để bật lại, nhưng
        // nhìn lướt là phân biệt ngay mốc nào đang có tác dụng.
        <span style={{ fontVariantNumeric: 'tabular-nums', opacity: r.enabled ? 1 : 0.45 }}>
          {r.threshold.toLocaleString('vi-VN')} {ruleTypeUnit(r.ruleType)}
        </span>
      ),
    },
    {
      title: 'Mức độ', dataIndex: 'severity', key: 'severity',
      render: (v: string) => <Tag color={SEVERITY_COLOR[v]}>{SEVERITY_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Đang dùng', key: 'enabled', width: 100,
      render: (_: unknown, r: RuleTier) => (
        <Tooltip title={r.enabled ? 'Đang được dùng để phát cảnh báo' : 'Đã tắt — không phát cảnh báo'}>
          <Switch size="small" checked={r.enabled} onChange={(v) => handleToggleTier(r, v)} />
        </Tooltip>
      ),
    },
    {
      title: 'Thao tác', key: 'action', width: 160,
      render: (_: unknown, r: RuleTier) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditTier(r)}>Sửa</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteTier(r)}>Xóa</Button>
        </Space>
      ),
    },
  ], [ruleTypes]);

  return (
    <div>
      <Card loading={loading} style={{ marginBottom: 16 }}>
        {/* Câu giải thích đặt ngay đầu phần 1: nói rõ vì sao phần này chỉ có ô chọn mức độ mà
            không có bảng nhiều mốc như phần 2. Trả lời trước câu hỏi người dùng sắp thắc mắc. */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="Khu vực đã đầy là tình huống nhị phân (còn 0 chỗ), không có nhiều mốc — chỉ chọn 1 mức độ."
        />
        <Form form={gateForm} layout="vertical" onFinish={handleSaveGates}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="zoneFullSeverity" label="Khu vực đã đầy — mức độ" rules={[{ required: true }]}>
                <Select options={SEVERITY_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="zoneNearFullAvailable"
                label="Số chỗ trống tuyệt đối coi là sắp đầy"
                rules={[{ required: true }]}
                // Ngưỡng theo SỐ CHỖ TUYỆT ĐỐI, bù cho ngưỡng theo phần trăm: khu 8 chỗ còn 2
                // chỗ là 25% (chưa tới ngưỡng %) nhưng thực tế đã sắp đầy. Hai ngưỡng bổ sung
                // cho nhau, giống cách OpsDashboard tính `nearFullZones`.
                tooltip="Ngưỡng phụ — bù cho khu nhỏ mà % không phản ánh đúng thực tế"
              >
                <InputNumber style={{ width: '100%' }} min={0} addonAfter="chỗ" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="zoneImbalanceMinPercent"
                label="Ngưỡng khu còn trống nhiều"
                rules={[{ required: true }]}
                tooltip="Điều kiện phụ khi so sánh mất cân bằng khu vực"
              >
                <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="parkingAnomalyMinMinutes"
                label="Thời gian đỗ tối thiểu để xét bất thường"
                rules={[{ required: true }]}
                tooltip="Tránh báo bất thường cho xe mới đỗ vài phút"
              >
                <InputNumber style={{ width: '100%' }} min={1} addonAfter="phút" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item
                name="suspiciousPaymentParkingAmount"
                label="Số tiền bất thường riêng cho gửi xe lẻ"
                rules={[{ required: true }]}
                tooltip="Ngưỡng phụ, thấp hơn ngưỡng chung, riêng cho giao dịch gửi xe lẻ"
              >
                <InputNumber style={{ width: '100%' }} min={0} step={50000} addonAfter="đ" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/,/g, '')) : 0) as any} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
            Lưu tham số phụ
          </Button>
        </Form>
      </Card>

      <Card
        title="Bảng ngưỡng theo mức độ"
        extra={
          <Space>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'excel',
                    icon: <FileExcelOutlined style={{ color: 'var(--success)' }} />,
                    label: 'Xuất Excel (.xlsx)',
                    onClick: () => {
                      if (tiers.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportAlertTiersExcel(tiers, ruleTypeLabel, ruleTypeUnit);
                      message.success('Đã xuất bảng ngưỡng ra Excel');
                    },
                  },
                  {
                    key: 'csv',
                    icon: <FileTextOutlined style={{ color: 'var(--secondary)' }} />,
                    label: 'Xuất CSV',
                    onClick: () => {
                      if (tiers.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportAlertTiersCsv(tiers, ruleTypeLabel, ruleTypeUnit);
                      message.success('Đã xuất bảng ngưỡng ra CSV');
                    },
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Xuất báo cáo</Button>
            </Dropdown>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddTier}>Thêm mốc ngưỡng</Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="Lọc theo loại cảnh báo"
            style={{ width: 240 }}
            value={filterRuleType}
            onChange={setFilterRuleType}
            options={ruleTypes.map((r) => ({ value: r.value, label: r.label }))}
          />
          <Select
            allowClear
            placeholder="Lọc theo mức độ"
            style={{ width: 180 }}
            value={filterSeverity}
            onChange={setFilterSeverity}
            options={SEVERITY_OPTIONS}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={tiers}
          rowKey="id"
          loading={tiersLoading}
          pagination={false}
          locale={{ emptyText: 'Chưa có mốc ngưỡng nào — bấm "Thêm mốc ngưỡng" để tạo' }}
        />
      </Card>

      <Modal
        title={tierModal.editing ? 'Sửa mốc ngưỡng' : 'Thêm mốc ngưỡng'}
        open={tierModal.open}
        onCancel={() => setTierModal({ open: false, editing: null })}
        onOk={() => tierForm.submit()}
        okText={tierModal.editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        okButtonProps={{ loading: tierSaving }}
      >
        <Form form={tierForm} layout="vertical" onFinish={handleSaveTier}>
          <Form.Item name="ruleType" label="Loại cảnh báo" rules={[{ required: true }]}>
            <Select
              placeholder="Chọn loại cảnh báo"
              options={ruleTypes.map((r) => ({ value: r.value, label: `${r.label} (${r.unit})` }))}
            />
          </Form.Item>
          <Form.Item name="threshold" label="Ngưỡng" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="severity" label="Mức độ" rules={[{ required: true }]}>
            <Select options={SEVERITY_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Divider />
      <Alert
        type="warning"
        showIcon
        message="Lưu ý"
        description="Nếu 1 loại cảnh báo chưa có mốc ngưỡng nào, hệ thống sẽ không phát cảnh báo cho loại đó — thêm ít nhất 1 mốc để bật lại."
      />
    </div>
  );
};

export default AlertSettingsPanel;
