import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';

export class PaymentController {
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      const parseNumber = (value: unknown) => {
        if (value === undefined || value === null || value === '') return undefined;
        const numericValue = Number(value);
        return Number.isNaN(numericValue) ? undefined : numericValue;
      };

      const result = await paymentService.findAll({
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
        paymentType: req.query.paymentType as string | undefined,
        search: req.query.search as string | undefined,
        minAmount: parseNumber(req.query.minAmount),
        maxAmount: parseNumber(req.query.maxAmount),
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const paymentController = new PaymentController();
