import { Request, Response } from 'express';
import { reportService } from '../services/report.service';

export class ReportController {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    try {
      const result = await reportService.getDashboard();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async getRevenue(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate, groupBy } = req.query;
      const result = await reportService.getRevenue(
        fromDate as string | undefined,
        toDate as string | undefined,
        groupBy as string | undefined,
      );
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async getVehicleStats(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = req.query;
      const result = await reportService.getVehicleStats(
        fromDate as string | undefined,
        toDate as string | undefined,
      );
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async getHourlyStats(_req: Request, res: Response): Promise<void> {
    try {
      const result = await reportService.getHourlyStats();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const longParkingHours = req.query.longParkingHours
        ? Number(req.query.longParkingHours)
        : undefined;
      const result = await reportService.getAlerts(longParkingHours);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const reportController = new ReportController();
