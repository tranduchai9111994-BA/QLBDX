import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Space, Button, Select, Modal, Form, Input, InputNumber,
  Switch, message, Divider, Alert, Tooltip, Typography, Collapse, Dropdown,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, InfoCircleOutlined, BulbOutlined,
  DownloadOutlined, FileExcelOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useExpertRules, ExpertRule, ExpertRuleInput, RuleCondition, RuleAction, RuleFormField } from '../hooks/useExpertRules';
import { confirmDanger } from '../utils/confirmDanger';
import api from '../api/axios';
import { exportExpertRulesExcel, exportExpertRulesCsv } from '../utils/reportExport';

const { Text, Paragraph } = Typography;

// domain "alert" (ngưỡng cảnh báo) đã có giao diện riêng, dễ dùng hơn ở tab "Cấu hình mức độ"
// (chọn loại cảnh báo có sẵn + ngưỡng + mức độ). Panel này chỉ dành cho luật "nâng cao" khác
// (gợi ý gói, phân tích DSS, gợi ý báo cáo) — tránh 2 nơi cùng sửa 1 dữ liệu gây rối.
const KNOWN_DOMAINS = ['package', 'analytics', 'report'];

const OPERATOR_OPTIONS = [
  { value: 'gte', label: '>= (lớn hơn hoặc bằng)' },
  { value: 'lte', label: '<= (nhỏ hơn hoặc bằng)' },
  { value: 'gt', label: '> (lớn hơn)' },
  { value: 'lt', label: '< (nhỏ hơn)' },
  { value: 'eq', label: '== (bằng)' },
  { value: 'neq', label: '!= (khác)' },
];

const EXAMPLE_RULE = {
  code: 'pkg_recommend_monthly_demo',
  domain: 'package',
  name: 'Gợi ý gói tháng (ví dụ)',
  description: 'Khách đỗ xe từ 5 lần/tháng trở lên thì gợi ý gói tháng, tiết kiệm ~20%',
  priority: 30,
  enabled: true,
  conditions: [{ fact: 'frequency', operator: 'gte' as const, value: 5 }],
  params: { package: 'monthly', savings: '~20%', durationDays: 30 },
};

interface RuleFormValues {
  code: string;
  domain: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
  /** Nhóm đã biết (package/analytics/report/alert): nhập bằng các ô cụ thể theo khuôn form của backend. */
  params?: Record<string, any>;
  /** Nhóm admin tự thêm: chưa có khuôn form nên vẫn nhập JSON tay. */
  actions?: { type: string; paramsJson: string }[];
}

/**
 * Quản trị bộ luật "nâng cao" của hệ chuyên gia (Knowledge Base) cho các nhóm không phải cảnh báo:
 * gợi ý gói dịch vụ, phân tích DSS, gợi ý báo cáo tuần. Mỗi luật gồm điều kiện (conditions) —
 * AND-joined, và hành động (actions) khi thỏa mãn. Priority thấp hơn được ưu tiên khớp trước
 * (dùng khi nhiều luật cùng domain đều thỏa mãn, ví dụ ngưỡng gói năm/quý/tháng).
 */
const ExpertRulesPanel: React.FC = () => {
  const { rules: allRules, domains, formSpec, loading, createRule, updateRule, setRuleEnabled, deleteRule, testEvaluate } = useExpertRules();
  const rules = useMemo(() => allRules.filter((r) => r.domain !== 'alert'), [allRules]);

  const [filterDomain, setFilterDomain] = useState<string | undefined>();
  const [modal, setModal] = useState<{ open: boolean; editing: ExpertRule | null }>({ open: false, editing: null });
  const [form] = Form.useForm<RuleFormValues>();
  const [saving, setSaving] = useState(false);

  const [testModal, setTestModal] = useState(false);
  const [testRuleId, setTestRuleId] = useState<number | undefined>();
  const [testFactValues, setTestFactValues] = useState<Record<string, number>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // durationDays hợp lệ = số ngày hiệu lực thật của các gói dịch vụ đang có trong hệ thống (ParkingPackage.durationDays).
  // Rule domain "package" dùng con số này để tra gói tương ứng (customerPackage.service.ts) — nếu admin gõ
  // 1 số không khớp gói nào, luật vẫn "fire" nhưng sẽ không tìm được gói để gợi ý cho khách.
  const [validDurationDays, setValidDurationDays] = useState<number[]>([]);
  useEffect(() => {
    api.get<{ durationDays: number }[]>('/packages', { params: { isActive: true } })
      .then((res) => setValidDurationDays(Array.from(new Set(res.data.map((p) => p.durationDays))).sort((a, b) => a - b)))
      .catch(() => {});
  }, []);

  const formDomain = Form.useWatch('domain', form);
  const watchedDomain = Array.isArray(formDomain) ? formDomain[0] : formDomain;

  // Khuôn form của nhóm đang chọn. Nhóm nào có khuôn thì nhập bằng ô cụ thể,
  // nhóm admin tự thêm (chưa có service tiêu thụ) thì vẫn nhập JSON tay.
  const activeSpec = watchedDomain ? formSpec[watchedDomain] : undefined;

  // Params cũ có khoá không nằm trong khuôn form (VD "template" của luật analytics)
  // — giữ nguyên khi lưu để không làm mất dữ liệu admin/hệ thống đã đặt trước đó.
  const [extraParams, setExtraParams] = useState<Record<string, any>>({});

  const domainOptions = useMemo(() => {
    const all = Array.from(new Set([...KNOWN_DOMAINS, ...domains.filter((d) => d !== 'alert')]));
    return all.map((d) => ({ value: d, label: formSpec[d] ? `${formSpec[d].label} (${d})` : d }));
  }, [domains, formSpec]);

  const filteredRules = useMemo(
    () => (filterDomain ? rules.filter((r) => r.domain === filterDomain) : rules),
    [rules, filterDomain],
  );

  const testRule = useMemo(() => rules.find((r) => r.id === testRuleId), [rules, testRuleId]);

  // Chỉ hiện ô nhập cho đúng fact mà LUẬT ĐANG CHỌN dùng — chọn luật cụ thể trước, không phải
  // chọn cả nhóm rồi đoán xem đang test cái nào (1 nhóm có thể có hàng chục luật).
  const testRuleFacts = useMemo(() => (testRule ? testRule.conditions.map((c) => c.fact) : []), [testRule]);

  useEffect(() => {
    setTestFactValues((prev) => {
      const next: Record<string, number> = {};
      testRuleFacts.forEach((f) => { next[f] = prev[f] ?? 0; });
      return next;
    });
  }, [testRuleFacts]);

  const openTest = (rule?: ExpertRule) => {
    setTestRuleId(rule?.id);
    setTestResult(null);
    setTestModal(true);
  };

  const openAdd = () => {
    form.resetFields();
    setExtraParams({});
    form.setFieldsValue({
      priority: 100,
      enabled: true,
      conditions: [{ fact: '', operator: 'gte', value: 0 }],
      params: {},
      actions: [{ type: '', paramsJson: '{}' }],
    });
    setModal({ open: true, editing: null });
  };

  const fillExample = () => {
    form.setFieldsValue(EXAMPLE_RULE);
  };

  const openEdit = (rule: ExpertRule) => {
    const spec = formSpec[rule.domain];
    const params = rule.actions[0]?.params ?? {};
    if (spec) {
      const known = new Set(spec.fields.map((f) => f.name));
      setExtraParams(Object.fromEntries(Object.entries(params).filter(([k]) => !known.has(k))));
    } else {
      setExtraParams({});
    }
    form.setFieldsValue({
      code: rule.code,
      domain: rule.domain,
      name: rule.name,
      description: rule.description || '',
      priority: rule.priority,
      enabled: rule.enabled,
      conditions: rule.conditions,
      params: spec ? Object.fromEntries(spec.fields.map((f) => [f.name, params[f.name]])) : {},
      actions: rule.actions.map((a) => ({ type: a.type, paramsJson: JSON.stringify(a.params, null, 2) })),
    });
    setModal({ open: true, editing: rule });
  };

  const doSave = async (payload: ExpertRuleInput) => {
    setSaving(true);
    try {
      if (modal.editing) {
        await updateRule(modal.editing.id, payload);
        message.success('Đã cập nhật luật');
      } else {
        await createRule(payload);
        message.success('Đã thêm luật');
      }
      setModal({ open: false, editing: null });
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không lưu được luật');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (values: RuleFormValues) => {
    const domain = Array.isArray(values.domain) ? values.domain[0] : values.domain;
    const spec = formSpec[domain];
    let actions: RuleAction[];

    if (spec) {
      // Loại hành động là cố định theo nhóm (1 nhóm chỉ dùng đúng 1 loại) nên không bắt admin gõ.
      const entered = Object.fromEntries(
        Object.entries(values.params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
      );
      actions = [{ type: spec.actionType, params: { ...extraParams, ...entered } }];
    } else {
      try {
        actions = (values.actions || []).map((a) => ({ type: a.type, params: JSON.parse(a.paramsJson || '{}') }));
      } catch {
        message.error('Params của hành động phải là JSON hợp lệ');
        return;
      }
    }

    const payload: ExpertRuleInput = {
      code: values.code,
      domain: values.domain,
      name: values.name,
      description: values.description,
      priority: values.priority,
      enabled: values.enabled,
      conditions: values.conditions,
      actions,
    };

    // domain "package" + action "recommend" cần durationDays khớp đúng gói đang có trong hệ thống,
    // nếu không luật vẫn fire được nhưng sẽ không tra ra gói nào để gợi ý cho khách (xem customerPackage.service.ts).
    if (domain === 'package' && validDurationDays.length > 0) {
      const mismatched = actions
        .filter((a) => a.type === 'recommend' && typeof a.params?.durationDays === 'number')
        .map((a) => a.params.durationDays as number)
        .filter((d) => !validDurationDays.includes(d));
      if (mismatched.length > 0) {
        Modal.confirm({
          title: 'durationDays không khớp gói nào đang có',
          content: `Giá trị durationDays = ${mismatched.join(', ')} không trùng số ngày của bất kỳ gói dịch vụ nào đang active (${validDurationDays.join(', ')} ngày). Luật vẫn sẽ "fire" đúng điều kiện, nhưng hệ thống sẽ không tìm được gói cụ thể để gợi ý cho khách. Vẫn lưu?`,
          okText: 'Vẫn lưu',
          cancelText: 'Sửa lại',
          onOk: () => doSave(payload),
        });
        return;
      }
    }

    await doSave(payload);
  };

  const handleDelete = (rule: ExpertRule) => {
    confirmDanger({
      title: 'Xác nhận xóa luật',
      content: `Xóa luật "${rule.name}" (${rule.code})?`,
      successMessage: 'Đã xóa luật',
      onConfirm: async () => { await deleteRule(rule.id); },
    });
  };

  // Bật/tắt nhanh dùng PATCH /expert-rules/:id/enabled — chỉ gửi đúng cờ enabled thay vì
  // gửi lại toàn bộ rule qua PUT, nên không thể ghi đè nhầm nội dung luật.
  const handleToggleEnabled = async (rule: ExpertRule, enabled: boolean) => {
    try {
      await setRuleEnabled(rule.id, enabled);
    } catch {
      message.error('Không cập nhật được trạng thái');
    }
  };

  const handleTest = async () => {
    if (!testRule) {
      message.warning('Chọn luật muốn test');
      return;
    }
    setTesting(true);
    try {
      const result = await testEvaluate(testRule.domain, testFactValues);
      setTestResult(result);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không evaluate được');
    } finally {
      setTesting(false);
    }
  };

  // Kết quả trả về evaluate toàn bộ luật cùng nhóm — tách riêng luật đang test ra làm kết quả
  // chính, các luật khác cùng nhóm (nếu có khớp) chỉ hiện phụ để tham khảo, tránh hiểu nhầm.
  const primaryTestResult = useMemo(() => {
    if (!testResult || !testRule) return null;
    return testResult.results?.find((r: any) => r.rule?.code === testRule.code) || null;
  }, [testResult, testRule]);
  const otherTestResults = useMemo(() => {
    if (!testResult || !testRule) return [];
    return (testResult.results || []).filter((r: any) => r.rule?.code !== testRule.code);
  }, [testResult, testRule]);

  /**
   * Vẽ 1 ô nhập của phần "Kết quả khi luật khớp" theo mô tả backend gửi về.
   * Nhờ vậy admin không phải biết JSON, và danh sách lựa chọn luôn khớp với
   * giá trị mà backend chấp nhận (expertSystem/domainSpecs.ts).
   */
  const renderParamField = (field: RuleFormField) => {
    const rules = field.required ? [{ required: true, message: `Nhập ${field.label.toLowerCase()}` }] : [];

    // Thời hạn gói: chỉ cho chọn số ngày của gói đang bán để khỏi gõ sai.
    if (field.name === 'durationDays' && validDurationDays.length > 0) {
      return (
        <Form.Item
          key={field.name}
          name={['params', field.name]}
          label={field.label}
          rules={rules}
          extra={field.help}
        >
          <Select
            placeholder="Chọn thời hạn"
            options={validDurationDays.map((d) => ({ value: d, label: `${d} ngày` }))}
          />
        </Form.Item>
      );
    }

    let control: React.ReactNode;
    if (field.type === 'select') {
      control = <Select placeholder={`Chọn ${field.label.toLowerCase()}`} options={field.options} />;
    } else if (field.type === 'number') {
      control = <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />;
    } else if (field.type === 'textarea') {
      control = <Input.TextArea rows={3} placeholder={field.placeholder} />;
    } else {
      control = <Input placeholder={field.placeholder} />;
    }

    return (
      <Form.Item
        key={field.name}
        name={['params', field.name]}
        label={field.label}
        rules={rules}
        extra={
          <>
            {field.help}
            {field.variables && field.variables.length > 0 && (
              <div style={{ marginTop: 4 }}>
                Có thể chèn số liệu thật bằng các chỗ trống sau:{' '}
                {field.variables.map((v) => (
                  <Tooltip key={v.name} title={v.description}>
                    <Tag style={{ cursor: 'help', marginBottom: 2 }}>{`{${v.name}}`}</Tag>
                  </Tooltip>
                ))}
              </div>
            )}
          </>
        }
      >
        {control}
      </Form.Item>
    );
  };

  const columns = [
    { title: 'Mã', dataIndex: 'code', key: 'code', render: (v: string) => <Text code>{v}</Text> },
    { title: 'Tên luật', dataIndex: 'name', key: 'name' },
    { title: 'Nhóm', dataIndex: 'domain', key: 'domain', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Ưu tiên', dataIndex: 'priority', key: 'priority', width: 90 },
    {
      title: 'Điều kiện (AND)', key: 'conditions',
      render: (_: unknown, r: ExpertRule) => (
        <Space direction="vertical" size={2}>
          {r.conditions.map((c, i) => (
            <Tag key={i} color="blue">{c.fact} {c.operator} {c.value}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Hành động', key: 'actions',
      render: (_: unknown, r: ExpertRule) => (
        <Space direction="vertical" size={2}>
          {r.actions.map((a, i) => (
            <Tooltip key={i} title={<pre style={{ margin: 0 }}>{JSON.stringify(a.params, null, 2)}</pre>}>
              <Tag color="purple">{a.type} <InfoCircleOutlined /></Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: 'Bật', key: 'enabled', width: 70,
      render: (_: unknown, r: ExpertRule) => (
        <Switch checked={r.enabled} onChange={(v) => handleToggleEnabled(r, v)} size="small" />
      ),
    },
    {
      title: 'Thao tác', key: 'action', width: 220,
      render: (_: unknown, r: ExpertRule) => (
        <Space>
          <Button size="small" icon={<PlayCircleOutlined />} onClick={() => openTest(r)}>Test</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)}>Xóa</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Collapse
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'guide',
            label: <span><BulbOutlined /> Hướng dẫn & ví dụ — đọc trước khi tạo luật</span>,
            children: (
              <div>
                <Paragraph>
                  Mỗi <b>luật</b> gồm 2 phần: <b>Điều kiện</b> (Input — dữ liệu thực tế lấy từ hệ thống, VD số lần khách đỗ xe/tháng)
                  và <b>Hành động</b> (Output — gợi ý/quyết định trả về khi điều kiện đúng). Tất cả điều kiện trong 1 luật phải
                  đúng cùng lúc (AND) thì luật mới "khớp" (fire).
                </Paragraph>
                <Paragraph>
                  <b>Ví dụ cụ thể:</b> Muốn hệ thống tự gợi ý <i>gói tháng</i> khi khách đỗ xe từ 5 lần/tháng trở lên:
                </Paragraph>
                <ul>
                  <li>Nhóm (domain): <Text code>package</Text></li>
                  <li>Điều kiện: fact = <Text code>frequency</Text>, toán tử = <Text code>&gt;=</Text>, giá trị = <Text code>5</Text></li>
                  <li>Hành động: type = <Text code>recommend</Text>, params = <Text code>{'{"package":"monthly","savings":"~20%","durationDays":30}'}</Text></li>
                </ul>
                <Paragraph>
                  <b>Mỗi nhóm yêu cầu params khác nhau</b> (backend validate theo nhóm — thiếu field sẽ không lưu được):
                </Paragraph>
                <ul>
                  <li>
                    <Text code>package</Text> → type <Text code>recommend</Text>, params cần{' '}
                    <Text code>package</Text> (yearly/quarterly/monthly), <Text code>durationDays</Text>, <Text code>savings</Text>
                  </li>
                  <li>
                    <Text code>analytics</Text> → type <Text code>decision</Text>, params cần <Text code>id</Text> (d1/d2/d3) và{' '}
                    <Text code>message</Text> (hoặc <Text code>recommendation</Text>)
                  </li>
                  <li>
                    <Text code>report</Text> → type <Text code>suggestion</Text>, params cần <Text code>type</Text>{' '}
                    (revenue_up / revenue_down / occupancy_warning / long_parking / renewal_campaign) và <Text code>message</Text>
                  </li>
                </ul>
                <Paragraph type="secondary">
                  Trong <Text code>message</Text> có thể dùng chỗ trống <Text code>{'{tenBien}'}</Text> để hệ thống điền số liệu thật
                  lúc chạy, VD <Text code>{'Có {longParkedCount} xe đỗ quá 24 giờ.'}</Text>
                </Paragraph>
                <Paragraph type="secondary">
                  Luật <b>tắt</b> (cột "Bật") sẽ không được nạp vào Inference Engine — không sinh gợi ý/cảnh báo/quyết định nào,
                  nhưng vẫn nằm trong danh sách để bật lại.
                </Paragraph>
                <Paragraph type="secondary">
                  Nghĩa là: nếu giá trị thực tế của <Text code>frequency</Text> ≥ 5, luật này khớp và trả về gợi ý gói tháng.
                  Nếu có nhiều luật cùng nhóm cùng khớp (VD khách đỗ 20 lần/tháng khớp cả luật gói tháng lẫn gói năm),
                  luật có <b>độ ưu tiên</b> (số nhỏ hơn) sẽ được chọn trước.
                </Paragraph>
                <Button icon={<BulbOutlined />} onClick={() => { openAdd(); fillExample(); }}>
                  Điền ví dụ này vào form — bấm để xem trước khi tự tạo luật của bạn
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Card
        title="Bộ luật nâng cao (gói dịch vụ / phân tích / báo cáo)"
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
                      if (filteredRules.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportExpertRulesExcel(filteredRules);
                      message.success('Đã xuất bộ luật ra Excel');
                    },
                  },
                  {
                    key: 'csv',
                    icon: <FileTextOutlined style={{ color: 'var(--secondary)' }} />,
                    label: 'Xuất CSV',
                    onClick: () => {
                      if (filteredRules.length === 0) { message.warning('Không có dữ liệu để xuất'); return; }
                      exportExpertRulesCsv(filteredRules);
                      message.success('Đã xuất bộ luật ra CSV');
                    },
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>Xuất báo cáo</Button>
            </Dropdown>
            <Button icon={<PlayCircleOutlined />} onClick={() => openTest()}>Test luật</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Thêm luật</Button>
          </Space>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="Lọc theo nhóm (domain)"
            style={{ width: 240 }}
            value={filterDomain}
            onChange={setFilterDomain}
            options={domainOptions}
          />
        </Space>
        <Table
          columns={columns}
          dataSource={filteredRules}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'Chưa có luật nào — xem mục "Hướng dẫn & ví dụ" ở trên rồi bấm "Thêm luật" để tạo' }}
        />
      </Card>

      <Modal
        title={modal.editing ? 'Sửa luật' : 'Thêm luật'}
        open={modal.open}
        onCancel={() => setModal({ open: false, editing: null })}
        onOk={() => form.submit()}
        okText={modal.editing ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        okButtonProps={{ loading: saving }}
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Space.Compact block>
            <Form.Item name="code" label="Mã luật (unique)" rules={[{ required: true }]} style={{ flex: 1, marginRight: 8 }}>
              <Input placeholder="vd: pkg_recommend_monthly" disabled={!!modal.editing} />
            </Form.Item>
            <Form.Item name="domain" label="Nhóm (domain)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                placeholder="Chọn hoặc nhập nhóm"
                options={domainOptions}
                showSearch
                mode="tags"
                maxCount={1}
              />
            </Form.Item>
          </Space.Compact>
          <Form.Item name="name" label="Tên luật" rules={[{ required: true }]}>
            <Input placeholder="vd: Gợi ý gói tháng" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả (giải thích ngữ cảnh)">
            <Input.TextArea rows={2} placeholder="Vd: Khách đỗ >= 5 lần/tháng thì gợi ý gói tháng" />
          </Form.Item>
          <Space.Compact block>
            <Form.Item name="priority" label="Độ ưu tiên (nhỏ hơn = trước)" style={{ flex: 1, marginRight: 8 }}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="enabled" label="Kích hoạt" valuePropName="checked" style={{ flex: 1 }}>
              <Switch />
            </Form.Item>
          </Space.Compact>

          <Divider orientation="left" plain>Điều kiện (Input — tất cả phải đúng)</Divider>
          <Form.List name="conditions">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...restField} name={[name, 'fact']} rules={[{ required: true, message: 'Dữ kiện' }]}>
                      {activeSpec ? (
                        <Select
                          style={{ width: 280 }}
                          placeholder="Chọn dữ kiện"
                          showSearch
                          optionFilterProp="label"
                          options={activeSpec.facts.map((f) => ({
                            value: f.name,
                            label: f.label,
                            title: f.help ? `${f.name} — ${f.help}` : f.name,
                          }))}
                        />
                      ) : (
                        <Input placeholder="fact, vd: frequency" style={{ width: 280 }} />
                      )}
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'operator']} rules={[{ required: true }]}>
                      <Select options={OPERATOR_OPTIONS} style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true, message: 'Giá trị' }]}>
                      <InputNumber placeholder="Ngưỡng" style={{ width: 120 }} />
                    </Form.Item>
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ fact: '', operator: 'gte', value: 0 })} icon={<PlusOutlined />}>
                  Thêm điều kiện
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" plain>
            Kết quả khi luật khớp
            {activeSpec && <Tag color="purple" style={{ marginLeft: 8 }}>{activeSpec.actionType}</Tag>}
          </Divider>

          {!watchedDomain ? (
            <Alert
              type="info"
              showIcon
              message="Chọn Nhóm (domain) ở phía trên trước"
              description="Mỗi nhóm cần thông tin khác nhau, nên các ô nhập sẽ hiện ra theo đúng nhóm bạn chọn."
            />
          ) : activeSpec ? (
            <>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message={activeSpec.description}
                description={
                  <>Loại hành động của nhóm này luôn là <Text code>{activeSpec.actionType}</Text> nên hệ thống tự điền, bạn không cần nhập.</>
                }
              />
              {watchedDomain === 'package' && validDurationDays.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`Thời hạn gói phải trùng một gói dịch vụ đang bán (${validDurationDays.join(', ')} ngày) — sai số này khiến luật vẫn khớp nhưng không tra ra gói nào để gợi ý.`}
                />
              )}
              {activeSpec.fields.map((field) => renderParamField(field))}
            </>
          ) : (
            <>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="Nhóm tự đặt — chưa có khuôn nhập sẵn"
                description="Nhóm này chưa có chức năng nào trong hệ thống đọc tới, nên phải nhập hành động dạng JSON. Chọn một nhóm có sẵn (Gợi ý gói / DSS / Báo cáo) để nhập bằng các ô thông thường."
              />
              <Form.List name="actions">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }} wrap>
                        <Form.Item {...restField} name={[name, 'type']} rules={[{ required: true, message: 'Loại' }]}>
                          <Input placeholder="type, vd: recommend" style={{ width: 200 }} />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'paramsJson']} rules={[{ required: true, message: 'Params' }]}>
                          <Input.TextArea placeholder='{"package":"monthly"}' style={{ width: 320 }} rows={2} />
                        </Form.Item>
                        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Button type="dashed" onClick={() => add({ type: '', paramsJson: '{}' })} icon={<PlusOutlined />}>
                      Thêm hành động
                    </Button>
                  </>
                )}
              </Form.List>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title="Test luật (Inference Engine)"
        open={testModal}
        onCancel={() => setTestModal(false)}
        footer={null}
        width={520}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Chọn đích danh 1 luật muốn kiểm tra — chỉ những thông số (fact) của đúng luật đó mới hiện ra để bạn nhập, không cần biết cú pháp JSON.</Text>
          <Select
            placeholder="Chọn luật muốn test"
            style={{ width: '100%' }}
            value={testRuleId}
            onChange={(id) => { setTestRuleId(id); setTestResult(null); }}
            showSearch
            optionFilterProp="label"
            options={rules.map((r) => ({ value: r.id, label: `${r.name} (${r.domain})` }))}
          />
          {testRule && (
            <Alert
              type="info"
              showIcon
              message={<>Đang test luật <b>{testRule.name}</b> — mã <Text code>{testRule.code}</Text>, nhóm <Tag>{testRule.domain}</Tag></>}
            />
          )}
          {testRule && !testRule.enabled && (
            <Alert
              type="warning"
              showIcon
              message="Luật này đang tắt"
              description={'Luật tắt không được nạp vào Inference Engine nên chạy thử sẽ không thấy nó khớp. Bật luật ở cột "Bật" rồi thử lại.'}
            />
          )}
          {testRuleFacts.map((fact) => (
            <div key={fact} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ width: 160 }}>{fact}</Text>
              <InputNumber
                style={{ flex: 1 }}
                value={testFactValues[fact]}
                onChange={(v) => setTestFactValues((prev) => ({ ...prev, [fact]: v ?? 0 }))}
              />
            </div>
          ))}
          <Button type="primary" onClick={handleTest} loading={testing} icon={<PlayCircleOutlined />}>
            Chạy thử
          </Button>
          {testResult && !primaryTestResult && (
            <Alert
              type="warning"
              showIcon
              message="Không có kết quả cho luật này"
              description="Luật đang tắt nên Inference Engine không đánh giá nó. Bật luật lên rồi chạy thử lại."
            />
          )}
          {testResult && primaryTestResult && (
            <Card
              size="small"
              style={{ marginTop: 8, borderColor: primaryTestResult.matched ? 'var(--success)' : undefined }}
            >
              <Text strong style={{ color: primaryTestResult.matched ? 'var(--success)' : 'var(--on-surface-variant)' }}>
                {primaryTestResult.matched ? '✔ Luật KHỚP (fire)' : '✘ Luật KHÔNG khớp'}
              </Text>
              <div style={{ marginTop: 4 }}>{primaryTestResult.explanation}</div>
              {otherTestResults.length > 0 && (
                <Collapse
                  ghost
                  style={{ marginTop: 8 }}
                  items={[{
                    key: 'others',
                    label: `Các luật khác cùng nhóm "${testRule?.domain}" (${otherTestResults.filter((r: any) => r.matched).length} khớp / ${otherTestResults.length} tổng)`,
                    children: (
                      <ul style={{ margin: 0 }}>
                        {otherTestResults.map((r: any, i: number) => (
                          <li key={i} style={{ color: r.matched ? 'var(--success)' : 'var(--on-surface-variant)' }}>
                            {r.explanation}
                          </li>
                        ))}
                      </ul>
                    ),
                  }]}
                />
              )}
            </Card>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default ExpertRulesPanel;
