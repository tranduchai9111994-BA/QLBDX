import { Request, Response } from 'express';
import { vehicleTypeService } from '../services/vehicleType.service';

export class VehicleTypeController {
  async findAll(_req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleTypeService.findAll();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleTypeService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleTypeService.update(Number(req.params.id), req.body, req.user?.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleTypeService.delete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async scheduleRateChange(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleTypeService.scheduleRateChange(Number(req.params.id), req.body, req.user?.id);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async getRateHistory(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleTypeService.getRateHistory(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const vehicleTypeController = new VehicleTypeController();
