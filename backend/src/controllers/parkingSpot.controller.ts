/**
 * Controller chỗ đỗ (/api/parking-spots) — dữ liệu vẽ sơ đồ bãi ở màn hình Bãi đỗ xe.
 */
import { Request, Response } from 'express';
import { parkingSpotService } from '../services/parkingSpot.service';

export class ParkingSpotController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const zoneId = req.query.zoneId ? Number(req.query.zoneId) : undefined;
      const status = req.query.status as string | undefined;
      const result = await parkingSpotService.findAll(zoneId, status);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingSpotService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingSpotService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingSpotService.delete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const parkingSpotController = new ParkingSpotController();
