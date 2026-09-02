/**
 * Controller cho nhóm API vận hành bãi xe (/api/parking).
 *
 * Nhiệm vụ chính ở tầng này: đọc tham số từ URL / query string (vốn luôn là chuỗi), ép về đúng
 * kiểu rồi chuyển xuống Service. Không chứa nghiệp vụ tính toán.
 */
import { Request, Response } from 'express';
import { parkingService } from '../services/parking.service';

export class ParkingController {
  /**
   * GET /api/parking — danh sách lượt gửi (mặc định: xe đang đỗ).
   *
   * Query string luôn là chuỗi, nên các tham số số phải ép kiểu bằng `Number(...)` trước khi
   * truyền xuống service. Tham số không được gửi thì để `undefined` — service hiểu là "không lọc
   * theo tiêu chí này", khác hẳn với gửi giá trị 0.
   */
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

  /**
   * POST /api/parking/entry — ghi nhận xe vào.
   *
   * `req.user!.id` là người đang đăng nhập, lấy từ token nên không giả mạo được. Dấu `!` hợp lệ
   * ở đây vì route đã đi qua middleware `auth`, tới được hàm này thì chắc chắn đã có user.
   * Trả mã 201 (Created) vì thao tác tạo ra một bản ghi mới.
   */
  async entry(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.entry(req.body, req.user!.id);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** POST /api/parking/exit — xe ra bình thường: chốt lượt, tính tiền, sinh phiếu thu. */
  async exit(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.exit(req.body, req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** POST /api/parking/exit-exception — xe ra ngoại lệ (mất vé, miễn phí, giải phóng chỗ...). */
  async exitException(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.exitException(req.body, req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** GET /api/parking/:id/preview — báo giá trước khi cho xe ra. Chỉ đọc, không thay đổi dữ liệu. */
  async preview(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.preview(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** GET /api/parking/history — lịch sử lượt gửi đã hoàn tất, có phân trang. */
  async history(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.history({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        licensePlate: req.query.licensePlate as string | undefined,
        zoneId: req.query.zoneId ? Number(req.query.zoneId) : undefined,
        vehicleTypeId: req.query.vehicleTypeId ? Number(req.query.vehicleTypeId) : undefined,
        search: req.query.search as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** GET /api/parking/plate-history/:plate — toàn bộ lịch sử ra/vào của một biển số. */
  async plateHistory(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.plateHistory(String(req.params.plate || ''));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /**
   * GET /api/parking/smart-lookup/:plate — tra cứu thông minh khi nhân viên vừa gõ xong biển số.
   * Trả về thông tin xe/khách đã có, thói quen gửi xe và gợi ý chỗ đỗ để form tự điền.
   */
  async smartLookup(req: Request, res: Response): Promise<void> {
    try {
      const result = await parkingService.smartLookup(String(req.params.plate || ''));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const parkingController = new ParkingController();
