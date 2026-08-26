/**
 * Thuật toán tính phí gửi xe (pure function — dễ test / dễ giải thích bảo vệ).
 *
 * Quy tắc:
 * - durationHours = ceil(ms / 1 giờ)
 * - Nếu <= 24 giờ: fee = min(durationHours * hourlyRate, dailyRate)
 * - Nếu > 24 giờ: fee = ceil(durationHours / 24) * dailyRate
 * - Có gói active: fee = 0
 * - Gửi 0 phút / 0 ms: fee = 0
 */

export type FeeRates = {
  hourlyRate: number;
  dailyRate: number;
};

export type FeeCalcResult = {
  durationMs: number;
  durationMinutes: number;
  durationHours: number;
  fee: number;
  billedDays: number | null;
  cappedByDailyRate: boolean;
};

export function calcDurationParts(durationMs: number) {
  const safeMs = Math.max(0, durationMs);
  return {
    durationMs: safeMs,
    durationMinutes: Math.ceil(safeMs / (1000 * 60)),
    durationHours: Math.ceil(safeMs / (1000 * 60 * 60)),
  };
}

export function calculateParkingFee(
  durationMs: number,
  rates: FeeRates,
  options?: { hasPackage?: boolean }
): FeeCalcResult {
  const parts = calcDurationParts(durationMs);

  if (options?.hasPackage) {
    return {
      ...parts,
      fee: 0,
      billedDays: null,
      cappedByDailyRate: false,
    };
  }

  const hourlyRate = Number(rates.hourlyRate) || 0;
  const dailyRate = Number(rates.dailyRate) || 0;

  if (parts.durationHours <= 0) {
    return {
      ...parts,
      fee: 0,
      billedDays: null,
      cappedByDailyRate: false,
    };
  }

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

  const billedDays = Math.ceil(parts.durationHours / 24);
  return {
    ...parts,
    fee: billedDays * dailyRate,
    billedDays,
    cappedByDailyRate: false,
  };
}
