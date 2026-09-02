/**
 * Thuật toán tính phí gửi xe.
 *
 * Vị trí trong luồng:
 *   pages/ParkingExit.tsx (bấm "Xe ra") -> POST /api/parking/exit
 *     -> parking.service.ts lấy giá theo loại xe + kiểm tra gói
 *     -> calculateParkingFee() ở file này ra số tiền
 *     -> tạo bản ghi Payment -> màn hình Thanh toán
 *
 * Đây là HÀM THUẦN (pure function): kết quả chỉ phụ thuộc tham số truyền vào, không đọc DB,
 * không đọc giờ hệ thống. Nhờ vậy có thể kiểm thử bằng cách gọi trực tiếp với dữ liệu giả —
 * xem backend/src/utils/feeCalculator.test.ts, chạy bằng `npm test`.
 *
 * Quy tắc tính (ví dụ với xe máy: hourlyRate = 5.000đ, dailyRate = 30.000đ):
 * - durationHours = làm tròn LÊN số giờ: gửi 1 giờ 5 phút tính thành 2 giờ.
 * - Gửi <= 24 giờ: fee = min(số giờ x giá giờ, giá ngày)
 *     gửi 3 giờ  -> min(15.000, 30.000) = 15.000đ
 *     gửi 10 giờ -> min(50.000, 30.000) = 30.000đ  (bị chặn trần bởi giá ngày)
 * - Gửi > 24 giờ: fee = số ngày làm tròn lên x giá ngày
 *     gửi 30 giờ -> ceil(30/24) = 2 ngày -> 60.000đ
 * - Khách đang có gói còn hiệu lực: fee = 0 (đã trả tiền theo gói).
 * - Gửi 0 giây (vào/ra nhầm): fee = 0.
 */

/** Bảng giá của MỘT loại xe, lấy từ bảng VehicleType trong DB (xem vehicleType.service.ts). */
export type FeeRates = {
  hourlyRate: number;
  dailyRate: number;
};

/**
 * Kết quả tính phí. Trả về cả các số trung gian chứ không chỉ mỗi `fee`, để màn hình Xe ra
 * giải thích được cho khách vì sao ra con số đó (và để bài test đối chiếu từng bước).
 */
export type FeeCalcResult = {
  durationMs: number;
  durationMinutes: number;
  /** Số giờ đã LÀM TRÒN LÊN — đây mới là số giờ dùng để tính tiền. */
  durationHours: number;
  /** Số tiền phải trả (VNĐ). */
  fee: number;
  /** Số ngày bị tính tiền, chỉ khác null khi gửi quá 24 giờ. */
  billedDays: number | null;
  /** true khi tính theo giờ ra số tiền lớn hơn giá ngày nên đã bị chặn ở mức giá ngày. */
  cappedByDailyRate: boolean;
};

/**
 * Đổi khoảng thời gian gửi xe (mili giây) sang phút và giờ.
 *
 * Luôn LÀM TRÒN LÊN (Math.ceil) theo thông lệ bãi giữ xe: bắt đầu sang giờ mới là tính
 * trọn giờ đó. Gửi 61 phút tính 2 giờ, không phải 1 giờ.
 */
export function calcDurationParts(durationMs: number) {
  // Chặn số âm: nếu dữ liệu lỗi khiến giờ ra sớm hơn giờ vào (đổi giờ hệ thống, nhập tay sai)
  // thì coi như 0 thay vì cho ra số phút âm rồi tính ra tiền âm.
  const safeMs = Math.max(0, durationMs);
  return {
    durationMs: safeMs,
    durationMinutes: Math.ceil(safeMs / (1000 * 60)),
    durationHours: Math.ceil(safeMs / (1000 * 60 * 60)),
  };
}

/**
 * Tính tiền gửi xe cho một lượt.
 *
 * @param durationMs Thời gian gửi tính bằng mili giây = giờ ra - giờ vào.
 * @param rates      Giá theo giờ và giá theo ngày của loại xe đó.
 * @param options    hasPackage = true nếu khách đang có gói còn hiệu lực.
 */
export function calculateParkingFee(
  durationMs: number,
  rates: FeeRates,
  options?: { hasPackage?: boolean }
): FeeCalcResult {
  const parts = calcDurationParts(durationMs);

  // Khách có gói còn hiệu lực thì miễn phí lượt này. Vẫn trả về đầy đủ thời gian gửi để hệ
  // thống ghi nhận lượt xe vào báo cáo — chỉ số tiền bằng 0, không phải bỏ qua lượt gửi.
  if (options?.hasPackage) {
    return {
      ...parts,
      fee: 0,
      billedDays: null,
      cappedByDailyRate: false,
    };
  }

  // Ép về number vì Prisma trả kiểu Decimal cho cột tiền tệ; `|| 0` phòng trường hợp loại xe
  // chưa khai báo giá (null) để không sinh ra NaN lan xuống toàn bộ phép tính.
  const hourlyRate = Number(rates.hourlyRate) || 0;
  const dailyRate = Number(rates.dailyRate) || 0;

  // Vào/ra trong cùng thời điểm (nhân viên bấm nhầm rồi cho ra ngay): không thu tiền.
  if (parts.durationHours <= 0) {
    return {
      ...parts,
      fee: 0,
      billedDays: null,
      cappedByDailyRate: false,
    };
  }

  // Trong ngày đầu tiên: tính theo giờ nhưng KHÔNG vượt quá giá trọn ngày. Nếu bỏ trần này
  // thì khách gửi 20 giờ phải trả nhiều hơn khách gửi trọn 24 giờ — vô lý về nghiệp vụ.
  if (parts.durationHours <= 24) {
    const rawHourly = parts.durationHours * hourlyRate;
    const fee = Math.min(rawHourly, dailyRate);
    return {
      ...parts,
      fee,
      billedDays: null,
      cappedByDailyRate: rawHourly > dailyRate,
    };
  }

  // Quá 24 giờ thì chuyển hẳn sang tính theo ngày, làm tròn lên. Gửi 25 giờ tính 2 ngày.
  const billedDays = Math.ceil(parts.durationHours / 24);
  return {
    ...parts,
    fee: billedDays * dailyRate,
    billedDays,
    cappedByDailyRate: false,
  };
}
