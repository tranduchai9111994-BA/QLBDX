/**
 * Middleware tự động ghi Nhật ký hoạt động (ai đã thêm/sửa/xoá cái gì, lúc nào, từ IP nào).
 *
 * Vị trí trong luồng: gắn vào các route thay đổi dữ liệu; dữ liệu ghi qua
 * services/activityLog.service.ts và hiển thị ở màn hình "Nhật ký hoạt động"
 * (frontend/src/pages/ActivityLogs.tsx).
 *
 * Ưu điểm của cách làm bằng middleware: không phải rải lệnh ghi log vào từng controller,
 * chỉ cần khai báo một lần ở route là mọi thao tác của route đó đều được ghi lại.
 */
import { Request, Response, NextFunction } from 'express';
import { logActivity } from '../services/activityLog.service';

// Quy đổi phương thức HTTP thành tên hành động lưu vào nhật ký. GET không có trong bảng
// này -> mọi thao tác chỉ xem dữ liệu đều không bị ghi log, tránh làm phình bảng ActivityLog.
const METHOD_TO_ACTION: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Lấy địa chỉ IP thật của người dùng.
 *
 * Khi hệ thống chạy sau proxy/nginx thì `req.socket.remoteAddress` chỉ là IP của proxy,
 * IP thật nằm ở header `x-forwarded-for` dạng "IP-thật, IP-proxy-1, IP-proxy-2" — nên lấy
 * phần tử đầu tiên. Không có header đó thì mới quay về đọc socket.
 */
function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? null;
}

/**
 * Middleware ghi nhật ký hoạt động cho một nhóm dữ liệu (`entity`, ví dụ 'vehicle', 'payment').
 *
 * Cách dùng trong route:  router.post('/', auth, activityLogger('vehicle'), controller.create)
 *
 * @param entity Tên nhóm dữ liệu hiển thị ở màn hình Nhật ký hoạt động.
 */
export const activityLogger = (entity: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Ghi log ở sự kiện 'finish' (sau khi phản hồi đã gửi xong) thay vì ghi trước khi gọi
    // controller, vì hai lý do: (1) lúc đó mới biết statusCode để bỏ qua request thất bại,
    // (2) việc ghi log không làm người dùng phải chờ thêm.
    res.on('finish', () => {
      const action = METHOD_TO_ACTION[req.method];
      if (!action) return;                 // GET / OPTIONS: chỉ đọc, không ghi log
      if (res.statusCode >= 400) return;    // Thất bại (400/403/500...) thì không tính là đã thao tác

      // Với sửa/xoá thì id nằm ở URL (/vehicles/:id). Với thêm mới thì không có :id nên
      // entityId để null — bản ghi log vẫn cho biết ai đã thêm dữ liệu gì, lúc nào.
      const rawId = req.params?.id;
      const entityId = rawId ? parseInt(rawId, 10) : null;

      logActivity({
        userId: req.user?.id ?? null,
        username: req.user?.username ?? 'anonymous',
        action,
        entity,
        entityId: entityId && !isNaN(entityId) ? entityId : null,
        ipAddress: getClientIp(req),
        statusCode: res.statusCode,
      });
    });

    next();
  };
};
