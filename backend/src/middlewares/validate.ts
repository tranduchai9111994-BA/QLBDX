/**
 * Middleware kiểm tra dữ liệu đầu vào bằng thư viện Zod.
 *
 * Vị trí trong luồng: Route -> validate() -> Controller -> Service.
 * Schema tương ứng nằm trong backend/src/validators/.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Kiểm tra dữ liệu trong BODY của request theo một schema Zod (xem thư mục validators/).
 *
 * Đặt trước controller trong chuỗi middleware nên dữ liệu sai định dạng bị chặn ngay ở
 * "cửa", controller và service không phải tự kiểm tra lại kiểu dữ liệu nữa.
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: 'Dữ liệu không hợp lệ',
        errors: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    // Gán lại body bằng dữ liệu Zod đã chuẩn hoá: các field thừa bị loại bỏ và chuỗi số
    // đã được ép về number. Nhờ vậy service luôn nhận đúng kiểu đã khai báo trong schema.
    req.body = result.data;
    next();
  };
};

/**
 * Tương tự `validate` nhưng kiểm tra QUERY STRING (?tuKhoa=...&trang=...).
 *
 * Khác một điểm: KHÔNG gán lại `req.query` bằng dữ liệu Zod đã chuẩn hoá (trong khi
 * `validate` có gán lại `req.body`). Vì vậy controller vẫn đọc giá trị gốc dạng chuỗi từ
 * `req.query` và tự ép kiểu — middleware này chỉ đóng vai trò chặn tham số sai.
 */
export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        message: 'Tham số truy vấn không hợp lệ',
        errors: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    next();
  };
};
