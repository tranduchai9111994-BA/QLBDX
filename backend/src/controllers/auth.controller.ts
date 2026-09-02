/**
 * Controller cho nhóm API tài khoản (/api/auth).
 *
 * Vai trò của tầng Controller trong dự án: nhận request -> gọi Service tương ứng -> chuyển
 * kết quả (hoặc lỗi) thành phản hồi HTTP. Toàn bộ nghiệp vụ nằm ở Service; controller không
 * tự truy vấn cơ sở dữ liệu.
 *
 * Quy ước xử lý lỗi dùng chung cả dự án: Service ném object dạng { status, message };
 * controller bắt lại và dùng `err.status || 500` — lỗi nghiệp vụ đã lường trước có mã riêng
 * (400/401/404), lỗi ngoài dự kiến mặc định 500.
 */
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { logActivity } from '../services/activityLog.service';

/** Lấy IP thật của client (ưu tiên header x-forwarded-for khi chạy sau proxy) — dùng để ghi nhật ký. */
function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

export class AuthController {
  /**
   * POST /api/auth/login
   *
   * Ghi nhật ký CẢ hai chiều: đăng nhập thành công (LOGIN) và thất bại (LOGIN_FAILED).
   * Ghi cả lần thất bại là có chủ đích — đó là dấu hiệu phát hiện ai đó đang dò mật khẩu,
   * xem được ở màn hình Nhật ký hoạt động.
   */
  async login(req: Request, res: Response): Promise<void> {
    const ip = getClientIp(req);
    // Lấy username ra trước khi gọi service: nếu đăng nhập lỗi thì vẫn cần biết người dùng
    // đã thử tên đăng nhập nào để ghi vào log.
    const username: string = req.body?.username ?? 'unknown';
    try {
      const result = await authService.login(req.body);
      logActivity({
        userId: result.user.id,
        username: result.user.username,
        action: 'LOGIN',
        ipAddress: ip,
        statusCode: 200,
      });
      res.json(result);
    } catch (err: any) {
      logActivity({
        userId: null,
        username,
        action: 'LOGIN_FAILED',
        details: err.message,
        ipAddress: ip,
        statusCode: err.status ?? 500,
      });
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** POST /api/auth/register — admin tạo tài khoản nhân viên mới. */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /**
   * GET /api/auth/me — hồ sơ của chính người đang đăng nhập.
   *
   * Lấy id từ `req.user` (do middleware `auth` giải mã từ token), KHÔNG lấy từ URL.
   * Nếu nhận id từ client thì ai cũng có thể đổi id để xem hồ sơ người khác.
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.getProfile(req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  /** PUT /api/auth/me — tự sửa hồ sơ. Cũng chỉ thao tác trên `req.user.id`, không nhận id từ client. */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.updateProfile(req.user!.id, req.body);
      logActivity({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'UPDATE',
        entity: 'Users',
        entityId: req.user!.id,
        ipAddress: getClientIp(req),
        statusCode: 200,
      });
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const authController = new AuthController();
