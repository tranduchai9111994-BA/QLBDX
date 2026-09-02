/**
 * Controller cấu hình chung cho cảnh báo (/api/alert-settings).
 * Các tham số dùng chung mà report.service.ts đọc khi quét cảnh báo.
 */
import { Request, Response } from 'express';
import { alertSettingsService } from '../services/alertSettings.service';

export class AlertSettingsController {
  async get(_req: Request, res: Response): Promise<void> {
    try {
      const result = await alertSettingsService.get();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await alertSettingsService.update(req.body, req.user?.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const alertSettingsController = new AlertSettingsController();
