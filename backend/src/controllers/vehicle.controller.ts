import { Request, Response } from 'express';
import { vehicleService } from '../services/vehicle.service';

export class VehicleController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleService.findAll({
        search: req.query.search as string | undefined,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
        vehicleTypeId: req.query.vehicleTypeId ? Number(req.query.vehicleTypeId) : undefined,
        parkingStatus: req.query.parkingStatus as 'parked' | 'outside' | undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async findByPlate(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleService.findByPlate(req.params.plate);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async findById(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleService.findById(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await vehicleService.delete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const vehicleController = new VehicleController();
