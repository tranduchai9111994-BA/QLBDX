/**
 * ImportModal — tái sử dụng cho mọi màn hình danh sách.
 * - Tải template Excel (2 sheet: Nhập dữ liệu + Lựa chọn)
 * - Kéo/thả hoặc chọn file xlsx/xls/csv
 * - Preview dữ liệu trước khi nhập
 * - Gọi callback onImport(rows) để caller xử lý API
 *
 * ===========================================================================================
 * Ý TƯỞNG: MỘT component dùng cho MỌI màn hình có nhập Excel (Khách hàng, Phương tiện, Gói,
 * Đăng ký gói). Thay vì mỗi trang tự viết phần đọc file, xem trước và báo lỗi, tất cả gom vào
 * đây; trang gọi chỉ cần khai báo hai thứ:
 *     columns    - file Excel có những cột nào, cột nào bắt buộc
 *     onImport   - làm gì với các dòng đọc được (gọi API nào)
 * Đây là mẫu "đảo ngược điều khiển": component lo QUY TRÌNH, trang gọi lo NGHIỆP VỤ.
 *
 * BỐN BƯỚC người dùng đi qua, tương ứng bốn phần của file:
 *   1. TẢI FILE MẪU  -> downloadTemplate()  : sinh file .xlsx nhiều sheet ngay trên trình duyệt
 *   2. CHỌN/THẢ FILE -> parseFile()         : đọc file, đổi tiêu đề cột thành khoá dữ liệu
 *   3. XEM TRƯỚC     -> previewCols + Table : nhìn lại trước khi ghi, ô thiếu bị tô đỏ
 *   4. NHẬP          -> handleImport()      : gọi onImport rồi hiện bảng tổng kết
 *
 * Vì sao có bước 3: nhập Excel là thao tác ghi hàng loạt, sai một cột là hỏng cả trăm dòng.
 * Cho xem trước để người dùng phát hiện lệch cột TRƯỚC khi dữ liệu vào cơ sở dữ liệu.
 * ===========================================================================================
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

/**
 * Mô tả MỘT cột của file Excel. Trang gọi khai báo mảng các ColumnDef này.
 *
 * Cặp `key` / `label` là mấu chốt của cả cơ chế:
 *   label = chữ người dùng THẤY trên file Excel ("Số điện thoại")
 *   key   = tên field mà API cần      ("phone")
 * parseFile() dùng cặp này để dịch ngược từ tiêu đề cột sang khoá dữ liệu.
 */
export interface ColumnDef {
  key: string;         // tên field gửi cho API
  label: string;       // tiêu đề cột hiện trên file Excel
  required?: boolean;  // có dấu * trong file mẫu, và tô đỏ ở bảng xem trước nếu để trống
  example?: string;    // giá trị mẫu điền sẵn ở dòng 2 của file mẫu
  choices?: string[];  // có giá trị -> liệt kê ở sheet "Lựa chọn hợp lệ" để người dùng copy
  note?: string;       // câu gợi ý, hiện ở sheet Lựa chọn và sheet Hướng dẫn
}

/**
 * Sheet TRA CỨU kèm trong file mẫu — VD danh sách khách hàng, danh sách gói hiện có.
 * Cần thiết vì file Excel của người dùng ghi tên/SĐT chứ không ghi id; không có sheet này họ
 * phải mở song song màn hình khác để copy, rất dễ gõ sai rồi cả file báo lỗi.
 */
export interface ReferenceSheet {
  name: string;        // tên tab sheet
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
  /* ══ STATE — ba giá trị này quyết định modal đang ở BƯỚC nào ══════════════════════════
       parsedRows rỗng            -> bước 1-2: mời tải file mẫu / chọn file
       parsedRows có, result null -> bước 3  : đang xem trước, chờ bấm Nhập
       result khác null           -> bước 4  : đã nhập xong, hiện tổng kết
     Suy ra bước từ dữ liệu thay vì nuôi thêm một state `step` riêng — bớt một thứ có thể lệch
     với thực tế.                                                                             */
  const { t } = useLanguage();
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ══ BƯỚC 1 — SINH FILE MẪU ═══════════════════════════════════════════════════════════ */

  /**
   * Tạo file Excel mẫu NGAY TRÊN TRÌNH DUYỆT (không gọi server) gồm tối đa bốn loại sheet:
   *   "Nhập dữ liệu"      - tiêu đề cột + một dòng ví dụ
   *   "Lựa chọn hợp lệ"   - các giá trị được phép cho từng cột
   *   các sheet tra cứu   - danh sách khách/gói/loại xe hiện có
   *   "Hướng dẫn"         - năm quy tắc nhập
   *
   * Vì sao phải có file mẫu: nếu để người dùng tự tạo file, họ sẽ đặt tên cột khác đi và bước
   * đọc file không khớp được cột nào. File mẫu bảo đảm tiêu đề cột đúng từ đầu.
   */
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: data entry
    // Cột bắt buộc được gắn dấu * vào tiêu đề. Lúc đọc file, bước parseFile sẽ CẮT dấu * này
    // đi trước khi so khớp — nên người dùng giữ nguyên hay xoá dấu * đều đọc được.
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
    // Chỉ tạo sheet "Lựa chọn" khi thật sự có cột cần nó. Sheet trống chỉ làm người dùng
    // hoang mang không biết để làm gì.
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

  /* ══ BƯỚC 2 — ĐỌC FILE NGƯỜI DÙNG NỘP ═════════════════════════════════════════════════ */

  /**
   * Đọc file Excel/CSV thành mảng object.
   *
   * Toàn bộ xử lý nằm TRÊN TRÌNH DUYỆT, không tải file lên server. Ưu điểm: không tốn băng
   * thông cho file hỏng, và người dùng thấy lỗi ngay lập tức.
   *
   * FileReader làm việc theo cơ chế BẤT ĐỒNG BỘ: `reader.readAsArrayBuffer` chỉ khởi động việc
   * đọc, xử lý thật nằm trong `reader.onload` và chạy sau. Vì thế hàm này không thể trả về dữ
   * liệu bằng return, mà phải gọi setState ở bên trong onload.
   */
  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        // Luôn đọc sheet ĐẦU TIÊN — khớp với file mẫu, nơi "Nhập dữ liệu" là sheet đầu. Các
        // sheet tra cứu/hướng dẫn nằm sau nên không bị đọc nhầm.
        const ws = wb.Sheets[wb.SheetNames[0]];
        // `header: 1` -> trả về mảng-của-mảng (dòng 0 là tiêu đề) thay vì mảng object. Cần dạng
        // này vì phải tự dịch tiêu đề sang khoá ở bước dưới.
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // < 2 dòng nghĩa là chỉ có tiêu đề, chưa có dữ liệu nào.
        if (raw.length < 2) {
          message.warning(t('importFileEmpty'));
          return;
        }

        // Map headers back to keys (strip * and trailing space)
        // Chuẩn hoá tiêu đề người dùng nộp: cắt dấu * ở cuối và bỏ khoảng trắng thừa, để khớp
        // được với `label` đã khai báo dù họ có sửa qua sửa lại.
        const headerRow = raw[0].map((h) => String(h ?? '').replace(/\s*\*$/, '').trim());
        // Bảng dịch "tiêu đề tiếng Việt -> khoá API". Đây là bước then chốt biến file Excel của
        // người dùng thành dữ liệu API hiểu được.
        const labelToKey: Record<string, string> = {};
        columns.forEach((c) => { labelToKey[c.label] = c.key; });

        const rows: Record<string, string>[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i];
          // Bỏ qua dòng trống. Rất hay gặp: người dùng xoá nội dung nhưng không xoá dòng, Excel
          // vẫn lưu lại dòng rỗng đó và nếu không bỏ qua sẽ sinh hàng loạt lỗi "thiếu trường".
          if (!row || row.every((cell) => !cell)) continue;
          const obj: Record<string, string> = {};
          // Duyệt theo TIÊU ĐỀ THẬT trong file, không theo thứ tự `columns` đã khai báo. Nhờ
          // vậy người dùng đảo thứ tự cột hoặc chèn thêm cột lạ vẫn đọc đúng — cột không khớp
          // khoá nào thì `key` là undefined và bị bỏ qua.
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
    // Trả false để chặn Ant Design tự tải file lên server — ta tự xử lý hoàn toàn ở trình duyệt.
    return false;
  };

  /* ══ BƯỚC 4 — CHẠY NHẬP ═══════════════════════════════════════════════════════════════ */

  /**
   * Giao các dòng đã đọc cho trang gọi qua `onImport`, rồi hiện kết quả.
   *
   * Component này KHÔNG biết gì về API: nó không rõ đang nhập khách hàng hay gói dịch vụ. Toàn
   * bộ phần đó nằm trong hàm `onImport` mà trang gọi truyền vào. Chính nhờ ranh giới này mà
   * một component phục vụ được bốn màn hình khác nhau.
   */
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

  /* ══ BƯỚC 3 — CỘT BẢNG XEM TRƯỚC ══════════════════════════════════════════════════════
     Dựng cột bảng xem trước từ chính `columns` đã khai báo — không viết tay ở đâu cả.        */
  const previewCols = columns.map((c) => ({
    title: c.label,
    dataIndex: c.key,
    key: c.key,
    width: 150,
    // Ô TRỐNG ở cột BẮT BUỘC được tô thẻ đỏ ngay trong bảng xem trước. Đây là giá trị lớn nhất
    // của bước xem trước: người dùng thấy đúng ô nào thiếu trước khi ghi, thay vì nhận về một
    // danh sách lỗi theo số dòng rồi phải dò ngược trong file.
    render: (v: string) => {
      if (!v && c.required) return <Tag color="red">{t('importFieldMissing')}</Tag>;
      return v || <span style={{ color: 'var(--outline)' }}>-</span>;
    },
  }));

  /**
   * Đóng modal và DỌN SẠCH state.
   *
   * Bắt buộc phải dọn: component không bị huỷ khi đóng (chỉ ẩn đi), nên không xoá thì lần mở
   * sau vẫn còn nguyên dữ liệu và bảng tổng kết của lần nhập trước.
   */
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
      // Modal TỰ RỘNG RA khi đã có dữ liệu xem trước: lúc mới mở chỉ cần chỗ cho hai nút, còn
      // lúc xem trước thì cần bề ngang cho bảng nhiều cột.
      width={parsedRows.length > 0 ? 900 : 520}
      footer={
      // Chân modal đổi theo bước (xem phần STATE): đang xem trước thì hiện "Chọn file khác" +
      // "Nhập", còn lại chỉ có nút Đóng.
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
