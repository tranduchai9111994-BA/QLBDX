import { Request, Response } from 'express';
import { expertRuleService } from '../services/expertRule.service';

export class ExpertRuleController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const enabledParam = req.query.enabled as string | undefined;
      const result = await expertRuleService.list({
        domain: req.query.domain as string | undefined,
        enabled: enabledParam !== undefined ? enabledParam === 'true' : undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async domains(_req: Request, res: Response): Promise<void> {
    try {
      const result = await expertRuleService.domains();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async formSpec(_req: Request, res: Response): Promise<void> {
    res.json(expertRuleService.formSpec());
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const result = await expertRuleService.getById(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 404).json({ message: err.message || 'Không tìm thấy' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await expertRuleService.create(req.body, req.user?.id);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await expertRuleService.update(Number(req.params.id), req.body, req.user?.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /**
   * PATCH /:id/enabled — bật/tắt nhanh, body chỉ nhận { enabled: boolean }.
   * Chặn ngay tại đây nếu client gửi thiếu hoặc gửi sai kiểu, tránh Prisma nhận undefined
   * rồi update "rỗng" mà vẫn trả 200 làm UI tưởng đã đổi trạng thái.
   */
  async setEnabled(req: Request, res: Response): Promise<void> {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ message: 'Trường "enabled" phải là true hoặc false' });
        return;
      }
      const result = await expertRuleService.setEnabled(Number(req.params.id), enabled, req.user?.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await expertRuleService.delete(Number(req.params.id));
      res.json({ message: 'Đã xóa' });
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async evaluate(req: Request, res: Response): Promise<void> {
    try {
      const { domain, facts } = req.body;
      const result = await expertRuleService.evaluate(domain, facts || {});
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const expertRuleController = new ExpertRuleController();
