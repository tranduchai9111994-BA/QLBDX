import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';

export class AnalyticsController {
  async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const period = (req.query.period as string) || 'month';
      const validPeriod = ['month', 'quarter', 'year'].includes(period) ? (period as 'month' | 'quarter' | 'year') : 'month';
      const result = await analyticsService.getInsights(validPeriod);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const analyticsController = new AnalyticsController();
