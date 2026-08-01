import { Request, Response } from 'express';
import { parkingService } from '../services/parking.service';

export class ParkingController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.findAll({
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        zoneId: req.query.zoneId ? Number(req.query.zoneId) : undefined,
        vehicleTypeId: req.query.vehicleTypeId ? Number(req.query.vehicleTypeId) : undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async entry(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.entry(req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async exit(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.exit(req.body, req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async preview(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.preview(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async history(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.history({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        licensePlate: req.query.licensePlate as string | undefined,
        zoneId: req.query.zoneId ? Number(req.query.zoneId) : undefined,
        vehicleTypeId: req.query.vehicleTypeId ? Number(req.query.vehicleTypeId) : undefined,
        search: req.query.search as string | undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const parkingController = new ParkingController();
