/**
 * ImportModal — tái sử dụng cho mọi màn hình danh sách.
 * - Tải template Excel (2 sheet: Nhập dữ liệu + Lựa chọn)
 * - Kéo/thả hoặc chọn file xlsx/xls/csv
 * - Preview dữ liệu trước khi nhập
 * - Gọi callback onImport(rows) để caller xử lý API
 */
import React, { useState, useRef } from 'react';
import {
  Modal, Button, Table, Tag, Upload, message, Space,
  Alert, Progress, Tooltip, Divider,
} from 'antd';
import {
  DownloadOutlined, UploadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, InboxOutlined, DeleteOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useLanguage } from '../context/LanguageContext';

export interface ColumnDef {
  key: string;         // field key (matches Excel header)
  label: string;       // Vietnamese column header
  required?: boolean;
  example?: string;    // sample value for template row
  choices?: string[];  // if set, listed in "Lựa chọn" sheet
  note?: string;       // hint shown as header comment in template
}

export interface ReferenceSheet {
  name: string;        // sheet tab name
  headers: string[];
  rows: string[][];
}

interface ImportResult {
  success: number;
  errors: string[];
}

interface ImportModalProps {
  open: boolean;
  title: string;
  columns: ColumnDef[];
  referenceSheets?: ReferenceSheet[];  // extra sheets with lookup data
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onClose: () => void;
}

const { Dragger } = Upload;

const ImportModal: React.FC<ImportModalProps> = ({
  open, title, columns, referenceSheets = [], onImport, onClose,
}) => {
  const { t } = useLanguage();
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Template generation ─────────────────────────────────────── */
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: data entry
    const headers = columns.map((c) => {
      const star = c.required ? ' *' : '';
      return `${c.label}${star}`;
    });
    const exampleRow = columns.map((c) => c.example ?? '');
    const aoa: string[][] = [headers, exampleRow];
    const ws1 = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws1['!cols'] = columns.map(() => ({ wch: 22 }));

    // Style header row (bold + bg) — note: xlsx OSS doesn't fully support rich style
    columns.forEach((_, i) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: i });
      if (!ws1[addr]) return;
      ws1[addr].s = {
        fill: { fgColor: { rgb: '0E3A6E' } },
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'center' },
      };
    });

    XLSX.utils.book_append_sheet(wb, ws1, 'Nhập dữ liệu');

    // Sheet 2: choices reference
    const choiceData: string[][] = [];
    columns.forEach((c) => {
      if (c.choices && c.choices.length > 0) {
        choiceData.push([`${c.label}${c.required ? ' *' : ''}`, ...c.choices]);
      } else if (c.note) {
        choiceData.push([`${c.label}`, `(${c.note})`]);
      }
    });
    if (choiceData.length > 0) {
      const ws2 = XLSX.utils.aoa_to_sheet([['Cột', 'Giá trị hợp lệ (copy/paste chính xác)'], ...choiceData]);
      ws2['!cols'] = [{ wch: 28 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Lựa chọn hợp lệ');
    }

    // Extra reference sheets (customers list, packages list, etc.)
    referenceSheets.forEach((rs) => {
      const ws = XLSX.utils.aoa_to_sheet([rs.headers, ...rs.rows]);
      ws['!cols'] = rs.headers.map(() => ({ wch: 24 }));
      XLSX.utils.book_append_sheet(wb, ws, rs.name);
    });

    // Guide sheet
    const guide: string[][] = [
      ['HƯỚNG DẪN NHẬP DỮ LIỆU'],
      [''],
      ['1. Chỉ nhập dữ liệu vào sheet "Nhập dữ liệu". Không xóa/thêm cột.'],
      ['2. Cột có dấu * là bắt buộc.'],
      ['3. Xem sheet "Lựa chọn hợp lệ" để lấy các giá trị được phép.'],
      ['4. Hàng đầu tiên (dòng 2) là ví dụ mẫu — xóa hoặc thay thế.'],
      ['5. Lưu file dưới dạng .xlsx hoặc .csv trước khi nhập.'],
      [''],
      ['Các cột bắt buộc:'],
      ...columns.filter((c) => c.required).map((c) => [`  - ${c.label}: ${c.note ?? ''}`]),
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guide);
    wsGuide['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Hướng dẫn');

    XLSX.writeFile(wb, `template_${title.replace(/\s/g, '_').toLowerCase()}.xlsx`);
    message.success(t('importTemplateDownloaded'));
  };

  /* ── Parse uploaded file ─────────────────────────────────────── */
  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (raw.length < 2) {
          message.warning(t('importFileEmpty'));
          return;
        }

        // Map headers back to keys (strip * and trailing space)
        const headerRow = raw[0].map((h) => String(h ?? '').replace(/\s*\*$/, '').trim());
        const labelToKey: Record<string, string> = {};
        columns.forEach((c) => { labelToKey[c.label] = c.key; });

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || row.every((cell) => !cell)) continue; // skip empty
          const obj: Record<string, string> = {};
          headerRow.forEach((h, ci) => {
            const key = labelToKey[h];
            if (key) obj[key] = row[ci] != null ? String(row[ci]).trim() : '';
          });
          rows.push(obj);
        }

        if (rows.length === 0) {
          message.warning(t('importNoValidData'));
          return;
        }

        setParsedRows(rows);
        setFileName(file.name);
        setResult(null);
      } catch (err) {
        message.error(t('importFileReadError'));
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // prevent default upload
  };

  /* ── Run import ──────────────────────────────────────────────── */
  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await onImport(parsedRows);
      setResult(res);
      if (res.success > 0) message.success(`${t('importRecordsSuccessPrefix')} ${res.success} ${t('importRecordsSuccessSuffix')}`);
      if (res.errors.length > 0) message.warning(`${res.errors.length} ${t('importRowsErrorSuffix')}`);
    } catch {
      message.error(t('importGenericError'));
    } finally {
      setImporting(false);
    }
  };

  /* ── Preview columns ─────────────────────────────────────────── */
  const previewCols = columns.map((c) => ({
    title: c.label,
    dataIndex: c.key,
    key: c.key,
    width: 150,
    render: (v: string) => {
      if (!v && c.required) return <Tag color="red">{t('importFieldMissing')}</Tag>;
      return v || <span style={{ color: 'var(--outline)' }}>-</span>;
    },
  }));

  const handleClose = () => {
    setParsedRows([]);
    setFileName('');
    setResult(null);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <UploadOutlined style={{ color: 'var(--primary)' }} />
          {`${t('importTitle')} — ${title}`}
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={parsedRows.length > 0 ? 900 : 520}
      footer={
        parsedRows.length > 0 && !result ? (
          <Space>
            <Button onClick={() => { setParsedRows([]); setFileName(''); }}>
              <DeleteOutlined /> {t('importChooseAnother')}
            </Button>
            <Button type="primary" loading={importing} onClick={handleImport} icon={<CheckCircleOutlined />}>
              {t('importSubmit')} ({parsedRows.length})
            </Button>
          </Space>
        ) : (
          <Button onClick={handleClose}>{t('btnClose')}</Button>
        )
      }
    >
      {/* Step 1: download template */}
      <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--info-container)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <DownloadOutlined style={{ color: 'var(--info)', fontSize: 20 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('importStep1')}</div>
          <div style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
            {t('importStep1Desc')}
          </div>
        </div>
        <Button icon={<DownloadOutlined />} onClick={downloadTemplate} type="default">
          {t('btnDownloadTemplate')}
        </Button>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Step 2: upload */}
      {parsedRows.length === 0 && !result && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--on-surface-variant)' }}>{t('importStep2')}</div>
          <Dragger
            accept=".xlsx,.xls,.csv"
            beforeUpload={parseFile}
            showUploadList={false}
            style={{ background: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)' }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: 'var(--info)' }} /></p>
            <p className="ant-upload-text">{t('importDragHint')}</p>
            <p className="ant-upload-hint">{t('importDragAccept')}</p>
          </Dragger>
        </div>
      )}

      {/* Preview */}
      {parsedRows.length > 0 && !result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CheckCircleOutlined style={{ color: 'var(--success)' }} />
            <span style={{ fontWeight: 600 }}>
              {t('importReadRowsPrefix')} <Tag color="blue">{parsedRows.length}</Tag> {t('importReadRowsSuffix')} <code>{fileName}</code>
            </span>
          </div>
          <Alert
            type="info" showIcon
            message={t('importPreview')}
            description={t('importPreviewDesc')}
            style={{ marginBottom: 12 }}
          />
          <Table
            columns={previewCols}
            dataSource={parsedRows.slice(0, 10).map((r, i) => ({ ...r, _idx: i }))}
            rowKey="_idx"
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={false}
            footer={() => parsedRows.length > 10 ? <span style={{ color: 'var(--outline)' }}>{t('importMoreRowsPrefix')} {parsedRows.length - 10} {t('importMoreRowsSuffix')}</span> : null}
          />
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          <Alert
            type={result.errors.length === 0 ? 'success' : 'warning'}
            showIcon
            message={`${t('importResultDone')}: ${result.success} ${t('importResultSuccessLabel')} / ${result.errors.length} ${t('importResultErrorLabel')}`}
            style={{ marginBottom: 12 }}
          />
          <Progress
            percent={Math.round((result.success / (result.success + result.errors.length)) * 100)}
            status={result.errors.length === 0 ? 'success' : 'normal'}
          />
          {result.errors.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: 160, overflowY: 'auto' }}>
              {result.errors.map((e, i) => (
                <div key={i} style={{ color: 'var(--error)', fontSize: 12, marginBottom: 4 }}>
                  <CloseCircleOutlined style={{ marginRight: 4 }} />{e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ImportModal;
