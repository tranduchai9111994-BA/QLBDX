import { Request, Response } from 'express';
import { activityLogService } from '../services/activityLog.service';

export class ActivityLogController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, userId, action, entity, username, from, to } = req.query;

      const result = await activityLogService.findAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        userId: userId ? parseInt(userId as string) : undefined,
        action: action as string | undefined,
        entity: entity as string | undefined,
        username: username as string | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
      });

      res.json(result);
    } catch {
      res.status(500).json({ message: 'Lỗi server' });
    }
  }
}

export const activityLogController = new ActivityLogController();
