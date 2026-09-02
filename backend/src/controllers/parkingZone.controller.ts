/**
 * Controller khu vực đỗ xe (/api/parking-zones).
 * Danh sách trả về kèm số liệu sức chứa (tổng chỗ / còn trống / đang dùng) của từng khu.
 */
import { Request, Response } from 'express';
import { parkingZoneService } from '../services/parkingZone.service';

export class ParkingZoneController {
  async findAll(_req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingZoneService.findAll();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingZoneService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingZoneService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingZoneService.delete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const parkingZoneController = new ParkingZoneController();
