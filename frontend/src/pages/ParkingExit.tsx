import React, { useState, useEffect } from 'react';
import { Table, Button, Card, message, Modal, Select, Tag, Input, Alert } from 'antd';
import { AxiosError } from 'axios';
import api from '../api/axios';
import { ParkingRecord, ParkingExitRequest } from '../types';
import { useAuth } from '../context/AuthContext';

interface ExitResponse {
  message: string;
  data: {
    entryTime: string;
    exitTime: string;
    durationMinutes: number;
    fee: number;
    hasPackage: boolean;
  };
}

interface PreviewFee {
  fee: number;
  hasPackage: boolean;
  durationMinutes: number;
  packageEndDate?: string | null;
  daysUntilExpiry?: number | null;
}

interface ReceiptData {
  licensePlate: string;
  vehicleTypeName: string;
  customerName: string;
  spotName: string;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
  fee: number;
  hasPackage: boolean;
  paymentMethod: 'cash' | 'card' | 'transfer';
  collectorName: string;
}

const ParkingExit: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [exitModal, setExitModal] = useState<ParkingRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [searchPlate, setSearchPlate] = useState<string>('');
  const [previewFee, setPreviewFee] = useState<PreviewFee | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const formatDuration = (durationMinutes: number) =>
    Math.floor(durationMinutes / 60) > 0
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}p`
      : `${durationMinutes}p`;

  const printReceipt = (receipt: ReceiptData) => {
    const paymentMethodLabel =
      receipt.paymentMethod === 'cash' ? 'Tiền mặt' : receipt.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ';
    const printWindow = window.open('', '_blank', 'width=900,height=900');

    if (!printWindow) {
      message.error('Trình duyệt đang chặn cửa sổ in biên nhận');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Biên nhận gửi xe</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 12px; padding: 24px; }
            h1 { margin: 0 0 8px; font-size: 28px; }
            h2 { margin: 0 0 24px; font-size: 16px; color: #4b5563; font-weight: 400; }
            .row { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .label { color: #6b7280; }
            .value { font-weight: 600; text-align: right; }
            .total { font-size: 20px; color: #b91c1c; }
            .free { color: #15803d; }
            .footer { margin-top: 24px; font-size: 13px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <h1>Biên nhận xe ra</h1>
            <h2>Hệ thống quản lý bãi đỗ xe</h2>
            <div class="row"><div class="label">Biển số</div><div class="value">${receipt.licensePlate}</div></div>
            <div class="row"><div class="label">Loại xe</div><div class="value">${receipt.vehicleTypeName}</div></div>
            <div class="row"><div class="label">Khách hàng</div><div class="value">${receipt.customerName}</div></div>
            <div class="row"><div class="label">Chỗ đỗ</div><div class="value">${receipt.spotName}</div></div>
            <div class="row"><div class="label">Giờ vào</div><div class="value">${new Date(receipt.entryTime).toLocaleString('vi-VN')}</div></div>
            <div class="row"><div class="label">Giờ ra</div><div class="value">${new Date(receipt.exitTime).toLocaleString('vi-VN')}</div></div>
            <div class="row"><div class="label">Thời gian đỗ</div><div class="value">${formatDuration(receipt.durationMinutes)}</div></div>
            <div class="row"><div class="label">Người thu</div><div class="value">${receipt.collectorName}</div></div>
            <div class="row"><div class="label">Phương thức thanh toán</div><div class="value">${paymentMethodLabel}</div></div>
            <div class="row"><div class="label">Phí gửi xe</div><div class="value ${receipt.hasPackage ? 'free' : 'total'}">${receipt.hasPackage ? 'Miễn phí (có gói)' : `${Number(receipt.fee).toLocaleString('vi-VN')} đ`}</div></div>
            <div class="footer">Biên nhận được in từ hệ thống lúc ${new Date().toLocaleString('vi-VN')}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get<ParkingRecord[]>('/parking', { params: { status: 'parked' } });
      setRecords(res.data);
    } catch (err) {
      message.error('Không tải được danh sách xe trong bãi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleExit = async () => {
    if (!exitModal) return;
    try {
      const res = await api.post<ExitResponse>('/parking/exit', {
        parkingRecordId: exitModal.id,
        paymentMethod,
      } as ParkingExitRequest);
      message.success(`Xe ra thành công! Phí: ${Number(res.data.data.fee).toLocaleString()}đ`);
      setReceiptData({
        licensePlate: exitModal.licensePlate,
        vehicleTypeName: exitModal.vehicleType?.name || '-',
        customerName: exitModal.vehicle?.customer?.fullName || 'Khách vãng lai',
        spotName: exitModal.parkingSpot ? `${exitModal.parkingSpot.zone?.name} — ${exitModal.parkingSpot.spotNumber}` : '-',
        entryTime: res.data.data.entryTime,
        exitTime: res.data.data.exitTime,
        durationMinutes: res.data.data.durationMinutes,
        fee: Number(res.data.data.fee),
        hasPackage: res.data.data.hasPackage,
        paymentMethod,
        collectorName: user?.fullName || 'Nhân viên thu phí',
      });
      setExitModal(null);
      fetchRecords();
    } catch (err) {
      const error = err as AxiosError<{ message: string }>;
      message.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const filteredRecords = records.filter(r =>
    !searchPlate || r.licensePlate.toLowerCase().includes(searchPlate.toLowerCase())
  );

  const columns = [
    { title: 'Biển số', dataIndex: 'licensePlate', key: 'licensePlate', render: (t: string) => <Tag className="plate-tag">{t}</Tag> },
    { title: 'Loại xe', key: 'vehicleTypeName', render: (_: any, r: ParkingRecord) => r.vehicleType?.name || '-' },
    { title: 'Chỗ đỗ', key: 'spot', render: (_: any, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Khách hàng', key: 'customerName', render: (_: any, r: ParkingRecord) => r.vehicle?.customer?.fullName || 'Khách vãng lai' },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', render: (t: string) => new Date(t).toLocaleString('vi-VN') },
    {
      title: 'Thời gian đỗ', key: 'duration', render: (_: any, r: ParkingRecord) => {
        const mins = Math.ceil((Date.now() - new Date(r.entryTime).getTime()) / 60000);
        const hours = Math.floor(mins / 60);
        return hours > 0 ? `${hours}h ${mins % 60}p` : `${mins}p`;
      }
    },
    {
      title: 'Thao tác', key: 'action', width: 120,
      render: (_: any, record: ParkingRecord) => (
        <Button type="primary" onClick={() => openExitModal(record)} size="small">Cho xe ra</Button>
      ),
    },
  ];

  const openExitModal = async (record: ParkingRecord) => {
    setExitModal(record);
    setPreviewFee(null);
    setPreviewLoading(true);
    try {
      const res = await api.get(`/parking/${record.id}/preview`);
      setPreviewFee(res.data);
    } catch (err) {
      message.error('Không tính trước được phí gửi xe');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">Ghi nhận xe ra</h2>
      <Card>
        <div className="toolbar">
          <Input.Search
            placeholder="Tìm biển số xe..."
            style={{ width: 300 }}
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
            allowClear
          />
        </div>
        <Table columns={columns} dataSource={filteredRecords} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="Xác nhận xe ra" open={!!exitModal} onOk={handleExit} onCancel={() => setExitModal(null)} okText="Xác nhận" cancelText="Hủy">
        {exitModal && (
          <div>
            <div className="info-panel" style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-default)', padding: 'var(--spacing-lg)', marginBottom: 'var(--spacing-lg)' }}>
              <div className="info-row"><span className="info-label">Biển số</span><Tag className="plate-tag">{exitModal.licensePlate}</Tag></div>
              <div className="info-row"><span className="info-label">Loại xe</span><span className="info-value">{exitModal.vehicleType?.name || '-'}</span></div>
              <div className="info-row"><span className="info-label">Giờ vào</span><span className="info-value">{new Date(exitModal.entryTime).toLocaleString('vi-VN')}</span></div>
              <div className="info-row"><span className="info-label">Giờ ra</span><span className="info-value">{new Date().toLocaleString('vi-VN')}</span></div>
              {previewLoading ? (
                <div className="info-row"><span className="info-label">Phí gửi xe</span><span className="info-value">Đang tính...</span></div>
              ) : previewFee && (
                <>
                  <div className="info-row"><span className="info-label">Thời gian đỗ</span><span className="info-value">{formatDuration(previewFee.durationMinutes)}</span></div>
                  <div className="info-row">
                    <span className="info-label">Phí gửi xe</span>
                    <span className="info-value" style={{ fontSize: '1.25rem', fontWeight: 700, color: previewFee.hasPackage ? 'var(--success)' : 'var(--error)' }}>
                      {previewFee.hasPackage ? 'Miễn phí (có gói)' : `${Number(previewFee.fee).toLocaleString()}đ`}
                    </span>
                  </div>
                  {previewFee.hasPackage && previewFee.daysUntilExpiry !== null && previewFee.daysUntilExpiry !== undefined && (
                    previewFee.daysUntilExpiry === 0 ? (
                      <Alert
                        type="error"
                        showIcon
                        message="Gói hết hạn hôm nay!"
                        description="Đây là lần sử dụng cuối. Nhắc khách gia hạn gói để tiếp tục miễn phí."
                        style={{ marginTop: 12, borderRadius: 6 }}
                      />
                    ) : previewFee.daysUntilExpiry <= 7 ? (
                      <Alert
                        type="warning"
                        showIcon
                        message={`Gói sắp hết hạn — còn ${previewFee.daysUntilExpiry} ngày`}
                        description={`Hết hạn ngày ${
                          previewFee.packageEndDate
                            ? new Date(previewFee.packageEndDate).toLocaleDateString('vi-VN')
                            : ''
                        }. Nhắc khách hàng gia hạn sớm.`}
                        style={{ marginTop: 12, borderRadius: 6 }}
                      />
                    ) : null
                  )}
                </>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--on-surface-variant)', marginBottom: 8 }}>Phương thức thanh toán</div>
              <Select value={paymentMethod} onChange={setPaymentMethod} style={{ width: '100%' }}>
                <Select.Option value="cash">Tiền mặt</Select.Option>
                <Select.Option value="card">Thẻ</Select.Option>
                <Select.Option value="transfer">Chuyển khoản</Select.Option>
              </Select>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Biên nhận xe ra"
        open={!!receiptData}
        onCancel={() => setReceiptData(null)}
        onOk={() => receiptData && printReceipt(receiptData)}
        okText="In biên nhận"
        cancelText="Đóng"
      >
        {receiptData && (
          <div className="info-panel" style={{ background: 'var(--surface-container-low)', borderRadius: 'var(--radius-default)', padding: 'var(--spacing-lg)' }}>
            <div className="info-row"><span className="info-label">Biển số</span><Tag className="plate-tag">{receiptData.licensePlate}</Tag></div>
            <div className="info-row"><span className="info-label">Khách hàng</span><span className="info-value">{receiptData.customerName}</span></div>
            <div className="info-row"><span className="info-label">Chỗ đỗ</span><span className="info-value">{receiptData.spotName}</span></div>
            <div className="info-row"><span className="info-label">Thời gian đỗ</span><span className="info-value">{formatDuration(receiptData.durationMinutes)}</span></div>
            <div className="info-row"><span className="info-label">Người thu</span><span className="info-value">{receiptData.collectorName}</span></div>
            <div className="info-row"><span className="info-label">PT thanh toán</span><span className="info-value">{receiptData.paymentMethod === 'cash' ? 'Tiền mặt' : receiptData.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Thẻ'}</span></div>
            <div className="info-row"><span className="info-label">Phí gửi xe</span><span className="info-value" style={{ fontWeight: 700, color: receiptData.hasPackage ? 'var(--success)' : 'var(--error)' }}>{receiptData.hasPackage ? 'Miễn phí (có gói)' : `${receiptData.fee.toLocaleString()}đ`}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ParkingExit;
