/**
 * Controller cho nhóm API thanh toán (/api/payments).
 */
import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';

export class PaymentController {
  /** GET /api/payments — danh sách giao dịch, có lọc và phân trang. */
  async findAll(req: Request, res: Response): Promise<void> {
    try {
      // Ép chuỗi từ query string về số một cách an toàn: ô lọc để trống ('' hoặc undefined) và
      // giá trị không phải số đều quy về `undefined` = "không áp dụng bộ lọc này". Nếu dùng thẳng
      // Number('') thì ra 0 và hệ thống sẽ hiểu nhầm thành "lọc số tiền từ 0".
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
        page: parseNumber(req.query.page),
        pageSize: parseNumber(req.query.pageSize),
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** PUT /api/payments/:id — admin sửa giao dịch ghi nhận sai. */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await paymentService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /**
   * GET /api/payments/my-shift — tổng hợp tiền do CHÍNH người đang đăng nhập thu.
   *
   * Lấy id từ `req.user!.id` chứ không nhận từ client, nên nhân viên chỉ xem được số liệu ca của
   * mình, không xem được của người khác.
   */
  async myShift(req: Request, res: Response): Promise<void> {
    try {
      const result = await paymentService.myShiftSummary(
        req.user!.id,
        req.query.from as string | undefined,
        req.query.to as string | undefined,
      );
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const paymentController = new PaymentController();
