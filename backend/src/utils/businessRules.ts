/**
 * Các quy tắc nghiệp vụ dùng chung, tách riêng khỏi Service để tái sử dụng và kiểm thử được.
 *
 * Gồm 3 nhóm:
 *   1. Chuẩn hoá biển số  — để đối chiếu xe vào / xe ra dù nhân viên gõ khác định dạng.
 *   2. Trạng thái gói     — gói khách mua đang còn hiệu lực, hết hạn, chưa tới hạn hay đã huỷ.
 *   3. Khớp xe với chỗ đỗ — xe máy không xếp vào chỗ ô tô và ngược lại.
 *
 * Tất cả đều là hàm thuần: không đọc DB, nhận gì trả nấy.
 */

/** Trạng thái thực tế của một gói khách đã mua tại thời điểm đang xét. */
export type PackageLifecycleStatus = 'active' | 'expired' | 'pending' | 'cancelled';

type SpotRuleInput = {
  spotNumber: string;
  spotType?: string | null;
  zone?: {
    name?: string | null;
    description?: string | null;
  } | null;
};

/**
 * Chuẩn hoá chuỗi tiếng Việt để so khớp: bỏ dấu và chuyển thành chữ thường.
 *
 * Cách làm: normalize('NFD') tách "ô" thành "o" + dấu mũ rời, rồi regex xoá toàn bộ ký tự dấu
 * (dải Unicode U+0300–U+036F). Nhờ vậy "Ô tô", "O TO", "o to" đều quy về "o to" — cần thiết vì
 * tên khu và tên loại xe do người dùng tự nhập, không thống nhất cách gõ dấu.
 */
function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Trả về 00:00:00 của ngày đó — để so sánh theo NGÀY, bỏ qua giờ phút. */
function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Chuẩn hoá biển số: bỏ dấu gạch, dấu chấm, khoảng trắng và chuyển hoa.
 * "29a-123.45", "29A 12345", "29A-123.45" đều quy về "29A12345".
 *
 * Cần thiết vì mỗi nhân viên gõ biển số một kiểu; nếu so sánh nguyên văn thì lúc xe ra sẽ
 * không tìm thấy lượt xe vào tương ứng, hoặc tạo trùng phương tiện trong danh mục.
 */
export function normalizeLicensePlate(licensePlate: string) {
  return licensePlate.replace(/[-.\s]/g, '').toUpperCase().trim();
}

/** So sánh hai biển số sau khi đã chuẩn hoá — dùng khi đối chiếu xe vào / xe ra. */
export function areLicensePlatesEqual(left: string, right: string) {
  return normalizeLicensePlate(left) === normalizeLicensePlate(right);
}

/**
 * Xác định trạng thái thật của gói khách đã mua tại thời điểm `now`.
 *
 * Vì sao phải tính chứ không đọc thẳng cột `status` trong DB: cột đó chỉ ghi nhận việc gói
 * có bị HUỶ hay không. Còn "hết hạn" hay "chưa tới ngày bắt đầu" phụ thuộc vào ngày hiện tại,
 * nếu lưu sẵn vào DB thì phải có tiến trình chạy nền cập nhật mỗi ngày mới đúng.
 *
 * So sánh theo NGÀY (dùng startOfDay), không theo giờ: gói hết hạn ngày 30/9 thì đến hết
 * 23:59 ngày 30/9 vẫn còn hiệu lực, chứ không hết hạn từ 00:01 sáng hôm đó.
 */
export function getPackageLifecycleStatus(
  status: string,
  startDate: Date,
  endDate: Date,
  now = new Date()
): PackageLifecycleStatus {
  // Đã huỷ thì xét trước tiên: gói bị huỷ không còn hiệu lực kể cả khi vẫn trong hạn.
  if (status === 'cancelled') {
    return 'cancelled';
  }

  const today = startOfDay(now);

  if (new Date(endDate) < today) {
    return 'expired';
  }

  if (new Date(startDate) > today) {
    return 'pending';
  }

  return 'active';
}

/**
 * Nhóm kích thước xe, dùng để kiểm tra xe có đỗ vừa chỗ hay không.
 * 'any' = không xác định được / chỗ dùng chung (khu VIP) -> chấp nhận mọi loại xe.
 */
export type VehicleCategory = 'two-wheel' | 'car' | 'large-car' | 'any';

/**
 * Suy ra chỗ đỗ này dành cho nhóm xe nào, dựa trên TÊN của khu và mã chỗ.
 *
 * Hạn chế đã biết: cơ sở dữ liệu hiện chưa có cột khai báo trực tiếp "khu này dành cho loại xe
 * nào", nên phải đoán từ tên do người dùng đặt ("Khu A - Xe máy", "Khu B - Ô tô con"). Đây là
 * giải pháp tạm; hướng cải tiến là thêm cột phân loại vào bảng ParkingZone rồi đọc thẳng.
 */
export function getSpotCategory(spot: SpotRuleInput): VehicleCategory {
  // Gộp tên khu + mô tả + mã chỗ + loại chỗ thành một chuỗi rồi dò từ khoá, vì thông tin phân
  // loại có thể nằm ở bất kỳ trường nào trong số đó tuỳ cách người dùng nhập liệu.
  const zoneText = `${spot.zone?.name || ''} ${spot.zone?.description || ''} ${spot.spotNumber || ''} ${spot.spotType || ''}`;
  const normalized = normalizeText(zoneText);

  // Khu VIP nhận mọi loại xe -> xét trước để không bị các nhánh bên dưới bắt nhầm.
  if (normalized.includes('vip')) {
    return 'any';
  }

  if (
    normalized.includes('xe may') ||
    normalized.includes('motor') ||
    normalized.startsWith('khu a') ||
    normalized.startsWith('a')
  ) {
    return 'two-wheel';
  }

  if (
    normalized.includes('o to lon') ||
    normalized.includes('xe tai') ||
    normalized.includes('bus') ||
    normalized.startsWith('khu c') ||
    normalized.startsWith('c')
  ) {
    return 'large-car';
  }

  if (
    normalized.includes('o to con') ||
    normalized.includes('o to') ||
    normalized.includes('car') ||
    normalized.startsWith('khu b') ||
    normalized.startsWith('b')
  ) {
    return 'car';
  }

  return 'any';
}

/**
 * Suy ra nhóm kích thước từ TÊN loại xe trong danh mục ("Xe máy", "Ô tô con", "Xe tải"...).
 *
 * Thứ tự các nhánh if quan trọng: phải xét "ô tô lớn / xe tải / xe khách" TRƯỚC "ô tô", vì
 * chuỗi "o to lon" cũng chứa "o to" — đảo thứ tự sẽ phân loại xe tải thành ô tô con.
 */
export function getVehicleCategory(vehicleTypeName: string): VehicleCategory {
  const normalized = normalizeText(vehicleTypeName);

  if (normalized.includes('xe dap') || normalized.includes('bicycle')) {
    return 'two-wheel';
  }

  if (normalized.includes('xe may') || normalized.includes('motor')) {
    return 'two-wheel';
  }

  if (
    normalized.includes('o to lon') ||
    normalized.includes('xe tai') ||
    normalized.includes('xe khach') ||
    normalized.includes('bus') ||
    normalized.includes('coach') ||
    normalized.includes('truck')
  ) {
    return 'large-car';
  }

  if (
    normalized.includes('o to') ||
    normalized.includes('car') ||
    normalized.includes('ban tai') ||
    normalized.includes('pickup')
  ) {
    return 'car';
  }

  return 'any';
}

/**
 * Kiểm tra xe có đỗ được vào chỗ này không — dùng khi nhân viên chọn chỗ ở màn hình Xe vào.
 *
 * Chỉ chặn khi CHẮC CHẮN không hợp (ví dụ xe tải vào chỗ xe máy). Nếu một trong hai bên không
 * xác định được nhóm ('any') thì cho qua: thà để nhân viên tự quyết còn hơn chặn oan một chỗ
 * trống hợp lệ chỉ vì tên khu đặt không theo quy ước.
 */
export function isSpotCompatibleWithVehicleType(spot: SpotRuleInput, vehicleTypeName: string) {
  const spotCategory = getSpotCategory(spot);
  const vehicleCategory = getVehicleCategory(vehicleTypeName);

  if (spotCategory === 'any' || vehicleCategory === 'any') {
    return true;
  }

  return spotCategory === vehicleCategory;
}
