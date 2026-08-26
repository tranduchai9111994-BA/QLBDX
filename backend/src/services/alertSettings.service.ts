import prisma from '../config/prisma';

export type AlertSettingsInput = Partial<{
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
}>;

class AlertSettingsService {
  /** Luôn dùng bản ghi id=1 — tạo với giá trị mặc định nếu chưa tồn tại (lần chạy đầu tiên). */
  async get() {
    const existing = await prisma.alertSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return prisma.alertSettings.create({ data: { id: 1 } });
  }

  async update(data: AlertSettingsInput, updatedBy?: number) {
    await this.get(); // đảm bảo bản ghi đã tồn tại trước khi update
    return prisma.alertSettings.update({
      where: { id: 1 },
      data: { ...data, updatedBy },
    });
  }
}

export const alertSettingsService = new AlertSettingsService();
