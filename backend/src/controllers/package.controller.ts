import { Request, Response } from 'express';
import { packageService } from '../services/package.service';

export class PackageController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const isActiveQuery = req.query.isActive as string | undefined;
      const parseNumber = (value: unknown) => {
        if (value === undefined || value === null || value === '') return undefined;
        const numericValue = Number(value);
        return Number.isNaN(numericValue) ? undefined : numericValue;
      };

      const result = await packageService.findAll({
        search: req.query.search as string | undefined,
        vehicleTypeId: parseNumber(req.query.vehicleTypeId),
        isActive: isActiveQuery === undefined ? undefined : isActiveQuery === 'true',
        includeInactive: req.query.includeInactive === 'true',
        minPrice: parseNumber(req.query.minPrice),
        maxPrice: parseNumber(req.query.maxPrice),
        minDuration: parseNumber(req.query.minDuration),
        maxDuration: parseNumber(req.query.maxDuration),
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await packageService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await packageService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await packageService.delete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const packageController = new PackageController();
