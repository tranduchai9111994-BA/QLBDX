import * as XLSX from 'xlsx';
import dayjs, { Dayjs } from 'dayjs';
import {
  AlertItem,
  ExceptionStats,
  HourlyStats,
  PaymentMethodReport,
  RevenueReport,
  VehicleStats,
} from '../types';

type GroupBy = 'day' | 'month' | 'year';

const money = (v: number) => Number(v || 0).toLocaleString('vi-VN');

export function formatPeriodLabel(period: string, groupBy: GroupBy): string {
  if (groupBy === 'year') return period;
  if (groupBy === 'month') return dayjs(period + '-01').format('MM/YYYY');
  return dayjs(period).format('DD/MM/YYYY');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: string | number) => {
    const text = String(val ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');
}

export interface ReportExportPayload {
  dateRange: [Dayjs, Dayjs];
  groupBy: GroupBy;
  revenue: RevenueReport[];
  vehicleStats: VehicleStats[];
  paymentMethods?: PaymentMethodReport | null;
  hourlyStats?: HourlyStats[];
  totals: {
    totalRevenue: number;
    totalParkingRev: number;
    totalPackageRev: number;
    totalTransactions: number;
    totalVehicles: number;
    avgTransaction: number;
  };
}

function fileStamp(range: [Dayjs, Dayjs]) {
  return `${range[0].format('DDMMYYYY')}-${range[1].format('DDMMYYYY')}`;
}

/** Apply bold + background fill to header row in a sheet */
function styleHeaderRow(sheet: XLSX.WorkSheet, rowIdx: number, colCount: number, fillColor = 'FF005DAA') {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!sheet[addr]) sheet[addr] = { t: 's', v: '' };
    sheet[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: fillColor }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'FFD4DAF0' } },
        bottom: { style: 'thin', color: { rgb: 'FFD4DAF0' } },
        left: { style: 'thin', color: { rgb: 'FFD4DAF0' } },
        right: { style: 'thin', color: { rgb: 'FFD4DAF0' } },
      },
    };
  }
}

function styleSummaryTitle(sheet: XLSX.WorkSheet, rowIdx: number) {
  const addr = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
  if (!sheet[addr]) sheet[addr] = { t: 's', v: '' };
  sheet[addr].s = {
    font: { bold: true, sz: 14, color: { rgb: 'FF005DAA' } },
    alignment: { horizontal: 'left' },
  };
}

export function exportRevenueExcel(payload: ReportExportPayload) {
  const { dateRange, groupBy, revenue, vehicleStats, paymentMethods, totals } = payload;
  const workbook = XLSX.utils.book_new();
  const stamp = fileStamp(dateRange);

  // ── Sheet 1: Tổng hợp ──────────────────────────────────────────────────────
  const summaryRows: (string | number)[][] = [
    ['HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE (QLBDX)', ''],
    ['BÁO CÁO THỐNG KÊ DOANH THU', ''],
    ['', ''],
    ['Kỳ báo cáo', `${dateRange[0].format('DD/MM/YYYY')} – ${dateRange[1].format('DD/MM/YYYY')}`],
    ['Nhóm theo', groupBy === 'day' ? 'Ngày' : groupBy === 'month' ? 'Tháng' : 'Năm'],
    ['Ngày xuất', dayjs().format('DD/MM/YYYY HH:mm')],
    ['', ''],
    ['CHỈ SỐ TỔNG HỢP', ''],
    ['Tổng doanh thu (đ)', totals.totalRevenue],
    ['Doanh thu gửi lẻ (đ)', totals.totalParkingRev],
    ['Doanh thu gói dịch vụ (đ)', totals.totalPackageRev],
    ['Số giao dịch', totals.totalTransactions],
    ['Trung bình / giao dịch (đ)', totals.avgTransaction],
    ['Tổng lượt xe hoàn tất', totals.totalVehicles],
    ['Tỷ trọng gửi lẻ (%)', totals.totalRevenue ? Math.round((totals.totalParkingRev / totals.totalRevenue) * 100) : 0],
    ['Tỷ trọng gói (%)', totals.totalRevenue ? Math.round((totals.totalPackageRev / totals.totalRevenue) * 100) : 0],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 30 }];
  // Style title rows
  if (summarySheet['A1']) summarySheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: 'FF005DAA' } } };
  if (summarySheet['A2']) summarySheet['A2'].s = { font: { bold: true, sz: 13, color: { rgb: 'FF283042' } } };
  if (summarySheet['A8']) summarySheet['A8'].s = { font: { bold: true, sz: 11, color: { rgb: 'FF005DAA' } } };
  // Style numeric value cells
  ['A9','A10','A11','A12','A13','A14','A15','A16'].forEach((addr) => {
    if (summarySheet[addr]) summarySheet[addr].s = { font: { color: { rgb: 'FF44474F' } } };
  });
  ['B9','B10','B11','B12','B13','B14','B15','B16'].forEach((addr) => {
    if (summarySheet[addr]) summarySheet[addr].s = {
      font: { bold: true, color: { rgb: 'FF005DAA' } },
      numFmt: '#,##0',
      alignment: { horizontal: 'right' },
    };
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tong hop');

  // ── Sheet 2: Doanh thu theo kỳ ─────────────────────────────────────────────
  const revenueData = revenue.map((item) => ({
    'Kỳ': formatPeriodLabel(item.period, groupBy),
    'Doanh thu gửi lẻ (đ)': Number(item.parkingRevenue),
    'Doanh thu gói (đ)': Number(item.packageRevenue),
    'Tổng doanh thu (đ)': Number(item.totalRevenue),
    'Số giao dịch': Number(item.totalTransactions),
    'TB/GD (đ)': Number(item.totalTransactions)
      ? Math.round(Number(item.totalRevenue) / Number(item.totalTransactions))
      : 0,
  }));
  // Add totals row
  revenueData.push({
    'Kỳ': 'TỔNG CỘNG',
    'Doanh thu gửi lẻ (đ)': totals.totalParkingRev,
    'Doanh thu gói (đ)': totals.totalPackageRev,
    'Tổng doanh thu (đ)': totals.totalRevenue,
    'Số giao dịch': totals.totalTransactions,
    'TB/GD (đ)': totals.avgTransaction,
  });
  const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
  revenueSheet['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 13 }, { wch: 14 }];
  styleHeaderRow(revenueSheet, 0, 6);
  // Bold last row (totals)
  const lastRow = revenueData.length; // 0-indexed: lastRow - 1, but header is row 0 so data starts row 1
  const totalRowIdx = revenueData.length; // after header
  for (let c = 0; c < 6; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (revenueSheet[addr]) {
      revenueSheet[addr].s = {
        font: { bold: true, color: { rgb: c === 3 ? 'FF005DAA' : 'FF131B2C' } },
        fill: { fgColor: { rgb: 'FFEAECF6' }, patternType: 'solid' },
        alignment: { horizontal: c === 0 ? 'left' : 'right' },
        numFmt: c > 0 ? '#,##0' : undefined,
      };
    }
  }
  XLSX.utils.book_append_sheet(workbook, revenueSheet, 'Doanh thu');

  // ── Sheet 3: Phân loại xe ──────────────────────────────────────────────────
  const vehicleData = vehicleStats.map((item) => ({
    'Loại xe': item.vehicleType,
    'Số lượt': item.totalRecords,
    'Doanh thu (đ)': Number(item.totalFees),
    'TB / lượt (đ)': item.totalRecords ? Math.round(Number(item.totalFees) / item.totalRecords) : 0,
    'Tỷ trọng (%)': totals.totalVehicles ? Math.round((item.totalRecords / totals.totalVehicles) * 100) : 0,
  }));
  const vehicleSheet = XLSX.utils.json_to_sheet(vehicleData);
  vehicleSheet['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 13 }];
  styleHeaderRow(vehicleSheet, 0, 5, 'FF1A7A2E');
  XLSX.utils.book_append_sheet(workbook, vehicleSheet, 'Loai xe');

  // ── Sheet 4: Phương thức thanh toán ────────────────────────────────────────
  if (paymentMethods && paymentMethods.byMethod.length > 0) {
    const methodData = paymentMethods.byMethod.map((item) => ({
      'Phương thức': item.label,
      'Số giao dịch': item.totalTransactions,
      'Doanh thu (đ)': item.totalAmount,
      'Tỷ trọng (%)': paymentMethods.totalAmount
        ? Math.round((item.totalAmount / paymentMethods.totalAmount) * 100)
        : 0,
    }));
    const methodSheet = XLSX.utils.json_to_sheet(methodData);
    methodSheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
    styleHeaderRow(methodSheet, 0, 4, 'FF934600');
    XLSX.utils.book_append_sheet(workbook, methodSheet, 'PTTT');

    if (paymentMethods.byType.length > 0) {
      const typeData = paymentMethods.byType.map((item) => ({
        'Loại giao dịch': item.label,
        'Số giao dịch': item.totalTransactions,
        'Doanh thu (đ)': item.totalAmount,
      }));
      const typeSheet = XLSX.utils.json_to_sheet(typeData);
      typeSheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 18 }];
      styleHeaderRow(typeSheet, 0, 3, 'FF6750A4');
      XLSX.utils.book_append_sheet(workbook, typeSheet, 'Loai GD');
    }
  }

  XLSX.writeFile(workbook, `bao-cao-doanh-thu_${stamp}.xlsx`);
}

export function exportRevenueCsv(payload: ReportExportPayload) {
  const rows = payload.revenue.map((item) => ({
    Ky: formatPeriodLabel(item.period, payload.groupBy),
    Gui_le: Number(item.parkingRevenue),
    Goi_dich_vu: Number(item.packageRevenue),
    Tong: Number(item.totalRevenue),
    So_GD: Number(item.totalTransactions),
  }));
  downloadBlob('\uFEFF' + toCsv(rows), `doanh-thu_${fileStamp(payload.dateRange)}.csv`, 'text/csv;charset=utf-8;');
}

export function exportVehicleCsv(payload: ReportExportPayload) {
  const rows = payload.vehicleStats.map((item) => ({
    Loai_xe: item.vehicleType,
    So_luot: item.totalRecords,
    Doanh_thu: Number(item.totalFees),
  }));
  downloadBlob('\uFEFF' + toCsv(rows), `loai-xe_${fileStamp(payload.dateRange)}.csv`, 'text/csv;charset=utf-8;');
}

export function exportPaymentMethodCsv(payload: ReportExportPayload) {
  const rows = (payload.paymentMethods?.byMethod || []).map((item) => ({
    Phuong_thuc: item.label,
    So_GD: item.totalTransactions,
    Doanh_thu: item.totalAmount,
  }));
  downloadBlob('\uFEFF' + toCsv(rows), `phuong-thuc-tt_${fileStamp(payload.dateRange)}.csv`, 'text/csv;charset=utf-8;');
}

export function printRevenueReport(payload: ReportExportPayload) {
  const { dateRange, groupBy, revenue, vehicleStats, paymentMethods, hourlyStats, totals } = payload;
  const topPeriod = [...revenue].sort((a, b) => Number(b.totalRevenue) - Number(a.totalRevenue))[0];
  const peakHour = [...(hourlyStats || [])].sort((a, b) => b.count - a.count)[0];

  const revenueRows = revenue.map((r) => `
    <tr>
      <td>${formatPeriodLabel(r.period, groupBy)}</td>
      <td class="num">${money(Number(r.parkingRevenue))}</td>
      <td class="num">${money(Number(r.packageRevenue))}</td>
      <td class="num strong">${money(Number(r.totalRevenue))}</td>
      <td class="num">${Number(r.totalTransactions).toLocaleString('vi-VN')}</td>
    </tr>
  `).join('');

  const vehicleRows = vehicleStats.map((v) => `
    <tr>
      <td>${v.vehicleType}</td>
      <td class="num">${v.totalRecords.toLocaleString('vi-VN')}</td>
      <td class="num">${money(Number(v.totalFees))}</td>
    </tr>
  `).join('');

  const methodRows = (paymentMethods?.byMethod || []).map((m) => `
    <tr>
      <td>${m.label}</td>
      <td class="num">${m.totalTransactions.toLocaleString('vi-VN')}</td>
      <td class="num">${money(m.totalAmount)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Báo cáo doanh thu QLBDX</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #131b2c; margin: 0; }
    .header { border-bottom: 3px solid #005daa; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 16px; }
    .brand { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #005daa; font-weight: 700; }
    h1 { margin: 4px 0 0; font-size: 22px; }
    .meta { text-align: right; font-size: 12px; color: #44474f; line-height: 1.6; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi { border: 1px solid #d4daf0; border-radius: 10px; padding: 12px; background: #f5f7ff; }
    .kpi .label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #565e71; }
    .kpi .value { margin-top: 6px; font-size: 18px; font-weight: 700; color: #005daa; }
    .section { margin-top: 18px; }
    .section h2 { font-size: 15px; margin: 0 0 8px; color: #0b2f57; border-left: 4px solid #005daa; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d4daf0; padding: 7px 8px; }
    th { background: #005daa; color: #fff; text-align: left; }
    td.num, th.num { text-align: right; }
    td.strong { font-weight: 700; color: #005daa; }
    tfoot td { background: #eaecf6; font-weight: 700; }
    .notes { margin-top: 16px; font-size: 12px; color: #44474f; }
    .footer { margin-top: 28px; display: flex; justify-content: space-between; gap: 40px; font-size: 12px; }
    .sign { text-align: center; min-width: 180px; }
    .sign .line { margin-top: 64px; border-top: 1px dashed #74777f; padding-top: 6px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">QLBDX · Parking Management</div>
      <h1>Báo cáo thống kê doanh thu</h1>
    </div>
    <div class="meta">
      <div>Kỳ: <strong>${dateRange[0].format('DD/MM/YYYY')} – ${dateRange[1].format('DD/MM/YYYY')}</strong></div>
      <div>Nhóm theo: <strong>${groupBy === 'day' ? 'Ngày' : groupBy === 'month' ? 'Tháng' : 'Năm'}</strong></div>
      <div>Ngày in: ${dayjs().format('DD/MM/YYYY HH:mm')}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="label">Tổng doanh thu</div><div class="value">${money(totals.totalRevenue)} đ</div></div>
    <div class="kpi"><div class="label">Gửi lẻ</div><div class="value">${money(totals.totalParkingRev)} đ</div></div>
    <div class="kpi"><div class="label">Gói dịch vụ</div><div class="value">${money(totals.totalPackageRev)} đ</div></div>
    <div class="kpi"><div class="label">Số giao dịch</div><div class="value">${totals.totalTransactions.toLocaleString('vi-VN')}</div></div>
  </div>

  <div class="notes">
    Trung bình/giao dịch: <strong>${money(totals.avgTransaction)} đ</strong>
    · Lượt xe: <strong>${totals.totalVehicles.toLocaleString('vi-VN')}</strong>
    ${topPeriod ? `· Kỳ cao nhất: <strong>${formatPeriodLabel(topPeriod.period, groupBy)} (${money(Number(topPeriod.totalRevenue))} đ)</strong>` : ''}
    ${peakHour && peakHour.count > 0 ? `· Giờ cao điểm: <strong>${peakHour.hour}h (${peakHour.count} lượt)</strong>` : ''}
  </div>

  <div class="section">
    <h2>Chi tiết doanh thu theo kỳ</h2>
    <table>
      <thead>
        <tr>
          <th>Kỳ</th>
          <th class="num">Gửi lẻ (đ)</th>
          <th class="num">Gói (đ)</th>
          <th class="num">Tổng (đ)</th>
          <th class="num">Số GD</th>
        </tr>
      </thead>
      <tbody>${revenueRows || '<tr><td colspan="5">Không có dữ liệu</td></tr>'}</tbody>
      <tfoot>
        <tr>
          <td>Tổng cộng</td>
          <td class="num">${money(totals.totalParkingRev)}</td>
          <td class="num">${money(totals.totalPackageRev)}</td>
          <td class="num">${money(totals.totalRevenue)}</td>
          <td class="num">${totals.totalTransactions.toLocaleString('vi-VN')}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="section">
    <h2>Thống kê theo loại xe</h2>
    <table>
      <thead><tr><th>Loại xe</th><th class="num">Số lượt</th><th class="num">Doanh thu (đ)</th></tr></thead>
      <tbody>${vehicleRows || '<tr><td colspan="3">Không có dữ liệu</td></tr>'}</tbody>
    </table>
  </div>

  ${methodRows ? `
  <div class="section">
    <h2>Doanh thu theo phương thức thanh toán</h2>
    <table>
      <thead><tr><th>Phương thức</th><th class="num">Số GD</th><th class="num">Doanh thu (đ)</th></tr></thead>
      <tbody>${methodRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <div class="sign">
      <div>Người lập biểu</div>
      <div class="line">Ký, họ tên</div>
    </div>
    <div class="sign">
      <div>Quản lý bãi đỗ</div>
      <div class="line">Ký, họ tên</div>
    </div>
  </div>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ─── ALERTS EXPORT ─────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<string, string> = {
  danger: 'Nguy hiểm',
  warning: 'Cảnh báo',
  info: 'Thông tin',
};

export function exportAlertsExcel(alerts: AlertItem[], longParkingHours: number) {
  const workbook = XLSX.utils.book_new();
  const now = dayjs().format('DD/MM/YYYY HH:mm');
  const stamp = dayjs().format('DDMMYYYY-HHmm');

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const dangerCount  = alerts.filter((a) => a.severity === 'danger').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const infoCount    = alerts.filter((a) => a.severity === 'info').length;

  const categoryMap = new Map<string, { danger: number; warning: number; info: number; total: number }>();
  alerts.forEach((a) => {
    const cur = categoryMap.get(a.category) ?? { danger: 0, warning: 0, info: 0, total: 0 };
    cur[a.severity as 'danger' | 'warning' | 'info'] += 1;
    cur.total += 1;
    categoryMap.set(a.category, cur);
  });

  const summaryRows: (string | number)[][] = [
    ['HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE (QLBDX)'],
    ['BÁO CÁO CẢNH BÁO BẤT THƯỜNG'],
    [],
    ['Ngày xuất', now],
    ['Ngưỡng xe đỗ lâu', `${longParkingHours} giờ`],
    ['Tổng số cảnh báo', alerts.length],
    [],
    ['PHÂN LOẠI THEO MỨC ĐỘ'],
    ['Mức độ', 'Số lượng'],
    ['Nguy hiểm', dangerCount],
    ['Cảnh báo', warningCount],
    ['Thông tin', infoCount],
    [],
    ['PHÂN LOẠI THEO DANH MỤC'],
    ['Danh mục', 'Nguy hiểm', 'Cảnh báo', 'Thông tin', 'Tổng'],
    ...Array.from(categoryMap.entries()).map(([cat, c]) => [cat, c.danger, c.warning, c.info, c.total]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Tong hop');

  // ── Sheet 2: All alerts detail ─────────────────────────────────────────────
  const detailRows = alerts.map((a) => ({
    'Mức độ': SEVERITY_LABEL[a.severity] ?? a.severity,
    'Danh mục': a.category,
    'Tiêu đề': a.title,
    'Mô tả chi tiết': a.description,
    'Thời gian': new Date(a.occurredAt).toLocaleString('vi-VN'),
  }));
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);
  detailSheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 60 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Chi tiet');

  // ── Sheet 3: Danger only ──────────────────────────────────────────────────
  const dangerRows = alerts
    .filter((a) => a.severity === 'danger')
    .map((a) => ({
      'Danh mục': a.category,
      'Tiêu đề': a.title,
      'Mô tả': a.description,
      'Thời gian': new Date(a.occurredAt).toLocaleString('vi-VN'),
    }));
  if (dangerRows.length > 0) {
    const dangerSheet = XLSX.utils.json_to_sheet(dangerRows);
    dangerSheet['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 60 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, dangerSheet, 'Nguy hiem');
  }

  XLSX.writeFile(workbook, `canh-bao_${stamp}.xlsx`);
}

/* ─── Export Exception Stats ─────────────────────────────────────────────── */
export function exportExceptionExcel(stats: ExceptionStats, dateRange: [Dayjs, Dayjs]) {
  const wb = XLSX.utils.book_new();
  const from = dateRange[0].format('DD/MM/YYYY');
  const to   = dateRange[1].format('DD/MM/YYYY');
  const stamp = dayjs().format('DDMMYYYY-HHmm');

  // ── Sheet 1: Tổng hợp ────────────────────────────────────────────────────
  const summaryAoa = [
    [`BÁO CÁO CHECKOUT NGOẠI LỆ — Từ ${from} đến ${to}`],
    [],
    ['Chỉ tiêu', 'Giá trị'],
    ['Tổng ca ngoại lệ', stats.totalCount],
    ['Ca được miễn phí', stats.waivedCount],
    ['Ca có phí ghi nhận', stats.totalCount - stats.waivedCount],
    ['Tổng phí ghi nhận (đ)', stats.totalFeeImpact],
    [],
    ['PHÂN BỐ THEO LÝ DO'],
    ['Lý do', 'Số ca', 'Phí ghi nhận (đ)', 'Tỷ lệ (%)'],
    ...stats.byReason.map((r) => [
      r.label,
      r.count,
      r.totalFeeWaived,
      stats.totalCount ? `${((r.count / stats.totalCount) * 100).toFixed(1)}%` : '0%',
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryAoa);
  ws1['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 22 }, { wch: 12 }];
  styleHeaderRow(ws1, 0, 4);
  XLSX.utils.book_append_sheet(wb, ws1, 'Tổng hợp');

  // ── Sheet 2: Chi tiết từng ca ─────────────────────────────────────────────
  const detailRows = stats.records.map((r) => ({
    'ID bản ghi':     r.id,
    'Biển số':        r.licensePlate,
    'Loại xe':        r.vehicleType,
    'Lý do ngoại lệ': r.reasonLabel,
    'Phí ghi nhận (đ)': r.fee,
    'Miễn phí':       r.fee === 0 ? 'Có' : 'Không',
    'Giờ vào':        r.entryTime ? dayjs(r.entryTime).format('DD/MM/YYYY HH:mm') : '-',
    'Giờ ra':         r.exitTime  ? dayjs(r.exitTime).format('DD/MM/YYYY HH:mm')  : '-',
    'Nhân viên XL':   r.staffName,
    'Ghi chú':        r.notes,
  }));
  const ws2 = XLSX.utils.json_to_sheet(detailRows);
  ws2['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 50 }];
  styleHeaderRow(ws2, 0, Object.keys(detailRows[0] || {}).length);
  XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết ca ngoại lệ');

  // ── Sheet 3: Chỉ ca miễn phí ──────────────────────────────────────────────
  const waivedRows = stats.records
    .filter((r) => r.fee === 0)
    .map((r) => ({
      'Biển số':        r.licensePlate,
      'Loại xe':        r.vehicleType,
      'Lý do':          r.reasonLabel,
      'Giờ ra':         r.exitTime ? dayjs(r.exitTime).format('DD/MM/YYYY HH:mm') : '-',
      'Nhân viên XL':   r.staffName,
      'Ghi chú':        r.notes,
    }));
  if (waivedRows.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(waivedRows);
    ws3['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 50 }];
    styleHeaderRow(ws3, 0, Object.keys(waivedRows[0]).length);
    XLSX.utils.book_append_sheet(wb, ws3, 'Ca miễn phí');
  }

  XLSX.writeFile(wb, `ngoai-le_${stamp}.xlsx`);
}

export function exportAlertsCsv(alerts: AlertItem[]) {
  const rows = alerts.map((a) => ({
    Muc_do: SEVERITY_LABEL[a.severity] ?? a.severity,
    Danh_muc: a.category,
    Tieu_de: a.title,
    Mo_ta: a.description,
    Thoi_gian: new Date(a.occurredAt).toLocaleString('vi-VN'),
  }));
  const stamp = dayjs().format('DDMMYYYY-HHmm');
  downloadBlob('\uFEFF' + toCsv(rows), `canh-bao_${stamp}.csv`, 'text/csv;charset=utf-8;');
}
