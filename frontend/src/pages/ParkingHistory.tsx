/**
 * Màn hình LỊCH SỬ gửi xe — các lượt đã hoàn tất, có phân trang và nhiều bộ lọc.
 * Phân trang thực hiện ở BACKEND (/api/parking/history), không tải hết dữ liệu về rồi cắt ở
 * trình duyệt, để màn hình vẫn nhẹ khi dữ liệu lớn dần theo thời gian.
 *
 * Màn hình có HAI cách tra cứu, đừng nhầm:
 *   1. BẢNG CHÍNH  - lọc theo khoảng ngày / khu / loại xe / từ khoá, phân trang ở backend.
 *   2. MODAL BIỂN SỐ - gõ (hoặc bấm vào biển số trong bảng) để xem TOÀN BỘ lịch sử của đúng
 *      một chiếc xe, kèm bốn ô thống kê tổng lượt / đang đỗ / đã ra / ngoại lệ.
 *   Cách 2 dùng API riêng /parking/plate-history/:plate, không phải lọc lại bảng chính.
 *
 * Vì sao phải phân trang ở backend chứ không như VehicleTypes lọc tại chỗ: bảng lượt gửi xe
 * TĂNG MÃI theo thời gian (mỗi ngày vài trăm dòng), sau một năm là hàng trăm nghìn dòng. Tải
 * hết về trình duyệt sẽ treo máy. Danh mục loại xe thì mãi chỉ có dăm bảy dòng nên khác nhau.
 */
import React, { useState, useEffect } from 'react';
import { Table, Card, DatePicker, Input, Tag, Button, Select, Space, message, Modal, Statistic, Row, Col, Alert } from 'antd';
import { SearchOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api/axios';
import { ParkingRecord, ParkingZone, VehicleType } from '../types';
import StatusTag from '../components/StatusTag';
import FilterBar from '../components/FilterBar';
import { defaultPagination } from '../utils/tablePagination';
import { formatDateTime } from '../utils/dateFormat';

const { RangePicker } = DatePicker;

interface Filters {
  from: string | null;
  to: string | null;
  licensePlate: string;
  search: string;
  zoneId?: number;
  vehicleTypeId?: number;
}

interface ParkingHistoryResponse {
  data: ParkingRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface PlateHistoryResponse {
  licensePlate: string;
  total: number;
  currentlyParked: number;
  completed: number;
  exceptionCount: number;
  records: ParkingRecord[];
}

const ParkingHistory: React.FC = () => {
  /* ══ KHỐI 1 — STATE ═══════════════════════════════════════════════════════════════════ */
  // --- Bảng chính ---
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);            // danh mục cho ô lọc "Khu"
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]); // danh mục cho ô "Loại xe"
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');               // chữ đang gõ (chưa chốt)
  const [filters, setFilters] = useState<Filters>({ from: null, to: null, licensePlate: '', search: '' });

  // `total` do BACKEND trả về, không phải records.length: records chỉ chứa dòng của trang hiện
  // tại (20 dòng), còn tổng số dòng thật có thể là 5.000. Thiếu `total` thì thanh phân trang
  // không biết phải vẽ bao nhiêu nút số trang.
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // --- Modal tra cứu theo biển số ---
  const [plateInput, setPlateInput] = useState('');
  const [plateModalOpen, setPlateModalOpen] = useState(false);
  const [plateLoading, setPlateLoading] = useState(false);
  const [plateHistory, setPlateHistory] = useState<PlateHistoryResponse | null>(null);

  /* ══ KHỐI 2 — ĐỌC DỮ LIỆU ═════════════════════════════════════════════════════════════ */

  /**
   * Tải một TRANG lịch sử + hai danh mục cho ô lọc.
   *
   * Tham số có giá trị mặc định (`page = pagination.current`) để gọi được cả hai kiểu:
   *   fetchRecords()        -> tải lại đúng trang đang xem (sau khi đổi dữ liệu)
   *   fetchRecords(1, 20)   -> nhảy về trang 1 (sau khi đổi bộ lọc)
   */
  const fetchRecords = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.licensePlate) params.licensePlate = filters.licensePlate;
      if (filters.search) params.search = filters.search;
      if (filters.zoneId) params.zoneId = filters.zoneId;
      if (filters.vehicleTypeId) params.vehicleTypeId = filters.vehicleTypeId;
      const [historyRes, zonesRes, vehicleTypesRes] = await Promise.all([
        api.get<ParkingHistoryResponse>('/parking/history', { params }),
        api.get<ParkingZone[]>('/parking-zones'),
        api.get<VehicleType[]>('/vehicle-types'),
      ]);
      setRecords(historyRes.data.data);
      setPagination({ current: historyRes.data.page, pageSize: historyRes.data.pageSize, total: historyRes.data.total });
      setZones(zonesRes.data);
      setVehicleTypes(vehicleTypesRes.data);
    } catch {
      message.error('Không tải được lịch sử xe ra vào');
    } finally {
      setLoading(false);
    }
  };

  // Đổi bộ lọc -> quay về trang 1.
  // Bắt buộc phải nhảy về trang 1: người dùng đang ở trang 7 mà đổi bộ lọc, kết quả mới có thể
  // chỉ còn 2 trang -> trang 7 rỗng, màn hình trắng và họ tưởng không có dữ liệu.
  useEffect(() => { fetchRecords(1, pagination.pageSize); }, [filters]);

  /* ══ KHỐI 3 — TRA CỨU THEO BIỂN SỐ ════════════════════════════════════════════════════ */

  /**
   * Tra toàn bộ lịch sử của MỘT biển số.
   *
   * Tham số `plate` không bắt buộc, để hàm phục vụ hai lối vào:
   *   - lookupPlateHistory()      -> lấy từ ô nhập (người dùng tự gõ rồi bấm nút)
   *   - lookupPlateHistory('29A') -> bấm thẳng vào biển số trong bảng
   */
  const lookupPlateHistory = async (plate?: string) => {
    const value = (plate || plateInput).trim();
    if (!value) {
      message.warning('Nhập biển số để tra cứu lịch sử');
      return;
    }
    setPlateLoading(true);
    setPlateModalOpen(true);
    try {
      // encodeURIComponent: biển số nằm TRONG đường dẫn URL. Ký tự lạ (dấu cách, dấu /) mà
      // không mã hoá sẽ làm URL vỡ thành nhiều đoạn và backend nhận sai tham số.
      const res = await api.get<PlateHistoryResponse>(`/parking/plate-history/${encodeURIComponent(value)}`);
      setPlateHistory(res.data);
      // Lọc luôn BẢNG CHÍNH theo biển số vừa tra, và xoá từ khoá tìm kiếm cũ - hai điều kiện
      // này loại trừ nhau, để cả hai thì người dùng không hiểu bảng đang lọc theo cái gì.
      setFilters((prev) => ({ ...prev, licensePlate: value, search: '' }));
      setSearchInput('');
    } catch {
      message.error('Không tra cứu được lịch sử biển số');
      setPlateHistory(null);
    } finally {
      setPlateLoading(false);
    }
  };

  /* ══ KHỐI 4 — CỘT BẢNG CHÍNH ══════════════════════════════════════════════════════════ */
  const columns = [
    {
      // Biển số làm thành NÚT BẤM được: đây là lối tắt hay dùng nhất - thấy một lượt khả nghi
      // thì bấm ngay vào biển số để xem cả lịch sử chiếc xe đó, không phải gõ lại.
      title: 'Biển số',
      dataIndex: 'licensePlate',
      key: 'licensePlate',
      width: 130,
      render: (t: string) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => { setPlateInput(t); lookupPlateHistory(t); }}>
          <Tag className="plate-tag">{t}</Tag>
        </Button>
      ),
    },
    { title: 'Loại xe', key: 'vehicleTypeName', width: 110, ellipsis: true, render: (_: unknown, r: ParkingRecord) => r.vehicleType?.name || '-' },
    { title: 'Chỗ đỗ', key: 'spot', width: 160, ellipsis: true, render: (_: unknown, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    { title: 'Khách', key: 'customer', width: 170, ellipsis: true, render: (_: unknown, r: ParkingRecord) => r.vehicle?.customer?.fullName || 'Khách vãng lai' },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', width: 160, ellipsis: true, render: (t: string) => formatDateTime(t) },
    { title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime', width: 160, ellipsis: true, render: (t?: string) => t ? formatDateTime(t) : '-' },
    { title: 'Thời gian (phút)', dataIndex: 'duration', key: 'duration', width: 130, ellipsis: true },
    {
      title: 'Phí (đ)', dataIndex: 'fee', key: 'fee', width: 130, align: 'right' as const,
      render: (v?: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v ? Number(v).toLocaleString() : '0'}</span>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 220,
      ellipsis: true,
      // Cột ghi chú nhận ra lượt XE RA NGOẠI LỆ (mất vé / vé hỏng / miễn phí) nhờ tiền tố
      // "[NGOAI_LE:" mà backend gắn vào ghi chú. Đánh dấu bằng tiền tố trong chuỗi thay vì thêm
      // hẳn một cột trong DB, nhờ đó lọc và thống kê được toàn bộ lượt ngoại lệ khi đối soát.
      render: (notes?: string) => {
        if (!notes) return '-';
        if (notes.includes('[NGOAI_LE:')) return <Tag color="orange">Ngoại lệ</Tag>;
        return notes;
      },
    },
  ];

  /* ══ KHỐI 5 — CỘT BẢNG TRONG MODAL BIỂN SỐ ════════════════════════════════════════════
     Bộ cột riêng, gọn hơn bảng chính: đã lọc theo đúng một biển số rồi nên bỏ các cột biển số,
     loại xe, tên khách - lặp lại y hệt ở mọi dòng thì chỉ tốn chỗ.                            */
  const plateColumns = [
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <StatusTag domain="parkingRecord" value={status} />,
    },
    { title: 'Giờ vào', dataIndex: 'entryTime', key: 'entryTime', width: 160, ellipsis: true, render: (t: string) => formatDateTime(t) },
    { title: 'Giờ ra', dataIndex: 'exitTime', key: 'exitTime', width: 160, ellipsis: true, render: (t?: string) => t ? formatDateTime(t) : '-' },
    { title: 'Chỗ đỗ', key: 'spot', width: 160, ellipsis: true, render: (_: unknown, r: ParkingRecord) => r.parkingSpot ? `${r.parkingSpot.zone?.name} — ${r.parkingSpot.spotNumber}` : '-' },
    {
      title: 'Phí (đ)', dataIndex: 'fee', key: 'fee', width: 130, align: 'right' as const,
      render: (v?: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v ? Number(v).toLocaleString() : '0'}</span>,
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 220,
      ellipsis: true,
      render: (notes?: string) => notes?.includes('[NGOAI_LE:') ? <Tag color="orange">Checkout ngoại lệ</Tag> : (notes || '-'),
    },
  ];

  /* ══ KHỐI 6 — XỬ LÝ BỘ LỌC ════════════════════════════════════════════════════════════ */

  /**
   * Đổi khoảng ngày. Đưa về chuỗi 'YYYY-MM-DD' vì đây là dạng ngày duy nhất mà cả trình duyệt,
   * backend và SQL Server đều hiểu giống nhau, không phụ thuộc cách hiển thị ngày của máy.
   * `dates` có thể là null khi người dùng bấm nút xoá của ô chọn ngày.
   */
  const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setFilters({
      ...filters,
      from: dates && dates[0] ? dates[0].format('YYYY-MM-DD') : null,
      to: dates && dates[1] ? dates[1].format('YYYY-MM-DD') : null,
    });
  };

  const resetFilters = () => {
    setSearchInput('');
    setPlateInput('');
    setFilters({ from: null, to: null, licensePlate: '', search: '' });
  };

  return (
    <div>
      <h2 className="page-title">Lịch sử xe ra vào</h2>

      {/* ══ KHỐI 7 — GIAO DIỆN ══════════════════════════════════════════════════════════
          Thứ tự: thẻ tra cứu biển số -> thanh lọc -> bảng chính -> modal lịch sử biển số. */}

      {/* Thẻ tra cứu biển số đặt TRÊN CÙNG, tách hẳn khỏi thanh lọc bên dưới: đây là hai việc
          khác nhau (tra một xe / duyệt toàn bộ lượt), để chung một hàng thì người dùng hay
          nhầm ô này với ô tìm kiếm. */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              <HistoryOutlined /> Tra cứu lịch sử theo biển số
            </div>
            <div style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
              Xem toàn bộ lần vào/ra, đang đỗ và checkout ngoại lệ của một biển số
            </div>
          </div>
          <Space wrap>
            <Input
              placeholder="VD: 59B112345"
              value={plateInput}
              // .toUpperCase() ngay khi gõ: biển số trong DB lưu dạng chữ in, gõ thường thì
              // tra không ra. Đổi tại chỗ để người dùng thấy ngay, không phải đoán.
              onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
              onPressEnter={() => lookupPlateHistory()}
              style={{ width: 200 }}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />} onClick={() => lookupPlateHistory()}>
              Tra cứu biển số
            </Button>
          </Space>
        </Space>
      </Card>

      <FilterBar onReset={resetFilters}>
        <RangePicker
          value={filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : undefined}
          onChange={handleDateChange}
          format="DD/MM/YYYY"
          placeholder={['Từ ngày', 'Đến ngày']}
        />
        <Input.Search
          placeholder="Tìm biển số, khách, khu, ghi chú..."
          style={{ width: 280 }}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={(value) => setFilters({ ...filters, search: value.trim(), licensePlate: '' })}
          allowClear
        />
        <Select
          value={filters.zoneId}
          allowClear
          placeholder="Lọc theo khu"
          style={{ width: 180 }}
          onChange={(value) => setFilters({ ...filters, zoneId: value })}
          options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
        />
        <Select
          value={filters.vehicleTypeId}
          allowClear
          placeholder="Lọc theo loại xe"
          style={{ width: 180 }}
          onChange={(value) => setFilters({ ...filters, vehicleTypeId: value })}
          options={vehicleTypes.map((vehicleType) => ({ value: vehicleType.id, label: vehicleType.name }))}
        />
      </FilterBar>

      <Card>
        {/* Dải thông báo nhắc bảng đang bị lọc theo một biển số, kèm nút bỏ lọc. Không có nó
            thì người dùng đóng modal xong thấy bảng chỉ còn vài dòng và tưởng mất dữ liệu. */}
        {filters.licensePlate && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Đang lọc lịch sử biển số: ${filters.licensePlate}`}
            action={<Button size="small" onClick={() => setFilters({ ...filters, licensePlate: '' })}>Bỏ lọc biển số</Button>}
          />
        )}
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={defaultPagination({
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
          })}
          // Bấm sang trang khác -> gọi lại API cho ĐÚNG trang đó. Vì phân trang nằm ở backend
          // nên Table không tự cắt được dữ liệu, phải tự tải.
          onChange={(p) => fetchRecords(p.current || 1, p.pageSize || pagination.pageSize)}
        />
      </Card>

      <Modal
        title={`Lịch sử biển số ${plateHistory?.licensePlate || plateInput}`}
        open={plateModalOpen}
        onCancel={() => setPlateModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setPlateModalOpen(false)}>Đóng</Button>,
        ]}
        width={900}
      >
        {plateHistory && (
          <>
            {/* Bốn ô thống kê do BACKEND đếm sẵn và trả về cùng dữ liệu, không đếm lại từ mảng
                `records` ở đây - mảng đó có thể đã bị cắt bớt, đếm lại sẽ ra số khác. */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card><Statistic title="Tổng lượt" value={plateHistory.total} /></Card></Col>
              <Col span={6}><Card><Statistic title="Đang đỗ" value={plateHistory.currentlyParked} valueStyle={{ color: 'var(--primary)' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Đã ra" value={plateHistory.completed} valueStyle={{ color: 'var(--success)' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Ngoại lệ" value={plateHistory.exceptionCount} valueStyle={{ color: 'var(--warning)' }} /></Card></Col>
            </Row>
            <Table
              columns={plateColumns}
              dataSource={plateHistory.records}
              rowKey="id"
              loading={plateLoading}
              pagination={{ pageSize: 8 }}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default ParkingHistory;
