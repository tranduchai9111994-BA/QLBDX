import prisma from '../config/prisma';

const VALID_SEVERITIES = ['danger', 'warning', 'info'];

export type AlertSettingsInput = Partial<{
  zoneNearFullAvailable: number;
  zoneImbalanceMinPercent: number;
  parkingAnomalyMinMinutes: number;
  suspiciousPaymentParkingAmount: number;
  zoneFullSeverity: string;
}>;

class AlertSettingsService {
  /** Luôn dùng bản ghi id=1 — tạo với giá trị mặc định nếu chưa tồn tại (lần chạy đầu tiên). */
  async get() {
    const existing = await prisma.alertSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return prisma.alertSettings.create({ data: { id: 1 } });
  }

  async update(data: AlertSettingsInput, updatedBy?: number) {
    if (data.zoneFullSeverity !== undefined && !VALID_SEVERITIES.includes(data.zoneFullSeverity)) {
      const err: any = new Error(`Mức độ không hợp lệ: ${data.zoneFullSeverity}`);
      err.status = 400;
      throw err;
    }
    await this.get(); // đảm bảo bản ghi đã tồn tại trước khi update
    return prisma.alertSettings.update({
      where: { id: 1 },
      data: { ...data, updatedBy },
    });
  }
}

export const alertSettingsService = new AlertSettingsService();
