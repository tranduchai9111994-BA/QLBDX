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
