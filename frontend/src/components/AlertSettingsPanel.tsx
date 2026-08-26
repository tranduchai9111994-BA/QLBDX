import React, { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Button, Row, Col, message, Divider, Alert } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import api from '../api/axios';

interface AlertSettingsForm {
  zoneNearFullAvailable: number;
  zoneNearFullPercent: number;
  zoneImbalanceMaxPercent: number;
  zoneImbalanceMinPercent: number;
  longParkingHours: number;
  parkingAnomalyMultiplier: number;
  parkingAnomalyMinMinutes: number;
  suspiciousPaymentHighAmount: number;
  suspiciousPaymentParkingAmount: number;
  revenueDropPercent: number;
  renewalFrequencyThreshold: number;
}

/**
 * Cấu hình ngưỡng định nghĩa "nguy hiểm"/"cảnh báo" — mỗi bãi xe có nhu cầu khác nhau
 * (VD: bãi nhỏ có thể coi 1 khu 70% là quá tải, bãi lớn thì 90%) nên đưa thành cấu hình
 * thay vì hardcode trong code, chỉ admin chỉnh được.
 */
const AlertSettingsPanel: React.FC = () => {
  const [form] = Form.useForm<AlertSettingsForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get<AlertSettingsForm>('/alert-settings');
      form.setFieldsValue(res.data);
    } catch {
      message.error('Không tải được cấu hình cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (values: AlertSettingsForm) => {
    setSaving(true);
    try {
      await api.put('/alert-settings', values);
      message.success('Đã lưu cấu hình ngưỡng cảnh báo');
    } catch {
      message.error('Không lưu được cấu hình');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card loading={loading}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Các ngưỡng dưới đây quyết định khi nào hệ thống coi một tình huống là Nguy hiểm/Cảnh báo/Thông tin."
        description="Mỗi bãi xe có quy mô và yêu cầu khác nhau — chỉnh lại cho phù hợp thực tế vận hành của bạn."
      />
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Divider orientation="left" plain>Khu vực bãi đỗ</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="zoneNearFullAvailable"
              label="Số chỗ trống còn lại để coi là &quot;sắp đầy&quot;"
              rules={[{ required: true }]}
              tooltip="Khu còn ít hơn hoặc bằng số chỗ này sẽ bị đánh dấu sắp đầy"
            >
              <InputNumber style={{ width: '100%' }} min={0} addonAfter="chỗ" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="zoneNearFullPercent"
              label="Hoặc tỷ lệ chỗ trống còn lại"
              rules={[{ required: true }]}
              tooltip="Khu còn ít hơn hoặc bằng % chỗ trống này cũng bị đánh dấu sắp đầy"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="zoneImbalanceMaxPercent"
              label="Ngưỡng khu quá tải"
              rules={[{ required: true }]}
              tooltip="Khu lấp đầy trên mức này được coi là quá tải khi so sánh mất cân bằng"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Form.Item
              name="zoneImbalanceMinPercent"
              label="Ngưỡng khu còn trống nhiều"
              rules={[{ required: true }]}
              tooltip="Khu lấp đầy dưới mức này được coi là còn trống nhiều khi so sánh mất cân bằng"
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} addonAfter="%" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Thời gian đỗ xe</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="longParkingHours"
              label="Xe đỗ quá lâu (mặc định)"
              rules={[{ required: true }]}
              tooltip="Xe đỗ liên tục quá số giờ này sẽ bị cảnh báo &quot;đỗ quá lâu&quot;"
            >
              <InputNumber style={{ width: '100%' }} min={1} addonAfter="giờ" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="parkingAnomalyMultiplier"
              label="Gấp bao nhiêu lần trung bình là bất thường"
              rules={[{ required: true }]}
              tooltip="So với thời gian đỗ trung bình 30 ngày của loại xe đó"
            >
              <InputNumber style={{ width: '100%' }} min={1} step={0.5} addonAfter="lần" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="parkingAnomalyMinMinutes"
              label="Thời gian đỗ tối thiểu để xét bất thường"
              rules={[{ required: true }]}
              tooltip="Tránh báo bất thường cho xe mới đỗ vài phút"
            >
              <InputNumber style={{ width: '100%' }} min={1} addonAfter="phút" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Thanh toán</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={12}>
            <Form.Item
              name="suspiciousPaymentHighAmount"
              label="Số tiền giao dịch bất thường (mọi loại)"
              rules={[{ required: true }]}
              tooltip="Giao dịch từ mức này trở lên sẽ bị đánh dấu bất thường, cần kiểm tra"
            >
              <InputNumber style={{ width: '100%' }} min={0} step={100000} addonAfter="đ" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/,/g, '')) : 0) as any} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Form.Item
              name="suspiciousPaymentParkingAmount"
              label="Số tiền bất thường riêng cho gửi xe lẻ"
              rules={[{ required: true }]}
              tooltip="Ngưỡng thấp hơn dành riêng cho giao dịch gửi xe lẻ (paymentType = parking)"
            >
              <InputNumber style={{ width: '100%' }} min={0} step={50000} addonAfter="đ" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => (v ? Number(v.replace(/,/g, '')) : 0) as any} />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" plain>Doanh thu &amp; gia hạn</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={12}>
            <Form.Item
              name="revenueDropPercent"
              label="Doanh thu sụt bao nhiêu % thì cảnh báo"
              rules={[{ required: true }]}
              tooltip="So với cùng thời điểm hôm qua"
            >
              <InputNumber style={{ width: '100%' }} min={1} max={100} addonAfter="%" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={12}>
            <Form.Item
              name="renewalFrequencyThreshold"
              label="Tần suất đỗ xe để gợi ý gia hạn"
              rules={[{ required: true }]}
              tooltip="Khách có gói sắp hết hạn và đỗ xe từ mức này trở lên trong 30 ngày sẽ được gợi ý liên hệ gia hạn"
            >
              <InputNumber style={{ width: '100%' }} min={1} addonAfter="lần/tháng" />
            </Form.Item>
          </Col>
        </Row>

        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
          Lưu cấu hình
        </Button>
      </Form>
    </Card>
  );
};

export default AlertSettingsPanel;
