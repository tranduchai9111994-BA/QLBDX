/**
 * Controller cấu hình MỨC ĐỘ cảnh báo (/api/alert-rule-tiers).
 *
 * Mỗi loại cảnh báo (xe đỗ quá lâu, khu sắp đầy, giao dịch bất thường...) có nhiều mốc ngưỡng,
 * mỗi mốc gắn một mức độ: Nguy hiểm / Cảnh báo / Thông tin. Người quản trị chỉnh các mốc này ở
 * tab "Cấu hình mức độ" trong màn hình Cảnh báo, thay vì phải sửa mã nguồn.
 */
import { Request, Response } from 'express';
import { alertRuleTierService, RULE_TYPES } from '../services/alertRuleTier.service';

export class AlertRuleTierController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const result = await alertRuleTierService.list({
        ruleType: req.query.ruleType as string | undefined,
        severity: req.query.severity as string | undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async ruleTypes(_req: Request, res: Response): Promise<void> {
    res.json(Object.entries(RULE_TYPES).map(([value, meta]) => ({ value, ...meta })));
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await alertRuleTierService.create(req.body, req.user?.id);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await alertRuleTierService.update(Number(req.params.id), req.body, req.user?.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await alertRuleTierService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa' });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const alertRuleTierController = new AlertRuleTierController();
