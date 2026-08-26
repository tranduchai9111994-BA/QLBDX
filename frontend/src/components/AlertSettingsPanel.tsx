import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Form, InputNumber, Select, Button, Row, Col, message, Divider, Alert,
  Table, Tag, Space, Modal,
} from 'antd';
import { SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api/axios';
import { confirmDanger } from '../utils/confirmDanger';

interface GateSettingsForm {
  zoneNearFullAvailable: number;
  zoneImbalanceMinPercent: number;
  parkingAnomalyMinMinutes: number;
  suspiciousPaymentParkingAmount: number;
  zoneFullSeverity: string;
}

interface RuleTypeMeta {
  value: string;
  label: string;
  unit: string;
  comparator: 'gte' | 'lte';
}

interface RuleTier {
  id: number;
  ruleType: string;
  threshold: number;
  severity: string;
}

const SEVERITY_OPTIONS = [
  { value: 'danger', label: '🔴 Nguy hiểm' },
  { value: 'warning', label: '🟠 Cảnh báo' },
  { value: 'info', label: '🔵 Thông tin' },
];

const SEVERITY_COLOR: Record<string, string> = { danger: 'red', warning: 'orange', info: 'blue' };
const SEVERITY_LABEL: Record<string, string> = { danger: 'Nguy hiểm', warning: 'Cảnh báo', info: 'Thông tin' };

/**
 * Cấu hình cảnh báo gồm 2 phần:
 * 1) Tham số phụ — vài giá trị đơn (VD: khu đã đầy = mức độ gì).
 * 2) Bảng ngưỡng nhiều mốc theo loại cảnh báo — admin tự thêm/sửa/xoá mốc (VD: Xe đỗ quá lâu:
 *    >=48h = Nguy hiểm, >=24h = Cảnh báo, >=12h = Thông tin), lọc được theo loại/mức độ.
 */
const AlertSettingsPanel: React.FC = () => {
  const [gateForm] = Form.useForm<GateSettingsForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ruleTypes, setRuleTypes] = useState<RuleTypeMeta[]>([]);
  const [tiers, setTiers] = useState<RuleTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [filterRuleType, setFilterRuleType] = useState<string | undefined>();
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>();

  const [tierModal, setTierModal] = useState<{ open: boolean; editing: RuleTier | null }>({ open: false, editing: null });
  const [tierForm] = Form.useForm<{ ruleType: string; threshold: number; severity: string }>();
  const [tierSaving, setTierSaving] = useState(false);

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

  useEffect(() => { fetchGateSettings(); fetchRuleTypes(); }, []);
  useEffect(() => { fetchTiers(); }, [filterRuleType, filterSeverity]);

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

  const columns = useMemo(() => [
    {
      title: 'Loại cảnh báo', dataIndex: 'ruleType', key: 'ruleType',
      render: (v: string) => ruleTypeLabel(v),
    },
    {
      title: 'Ngưỡng', key: 'threshold',
      render: (_: unknown, r: RuleTier) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.threshold.toLocaleString('vi-VN')} {ruleTypeUnit(r.ruleType)}</span>,
    },
    {
      title: 'Mức độ', dataIndex: 'severity', key: 'severity',
      render: (v: string) => <Tag color={SEVERITY_COLOR[v]}>{SEVERITY_LABEL[v] || v}</Tag>,
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
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAddTier}>Thêm mốc ngưỡng</Button>}
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
