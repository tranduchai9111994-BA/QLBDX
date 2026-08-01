import { Request, Response } from 'express';
import { customerService } from '../services/customer.service';

export class CustomerController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const isActiveQuery = req.query.isActive as string | undefined;
      const result = await customerService.findAll({
        search: req.query.search as string | undefined,
        isActive: isActiveQuery === undefined ? undefined : isActiveQuery === 'true',
        includeInactive: req.query.includeInactive === 'true',
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async findById(req: Request, res: Response): Promise<void> {
    try {
      const result = await customerService.findById(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await customerService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await customerService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await customerService.softDelete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const customerController = new CustomerController();
