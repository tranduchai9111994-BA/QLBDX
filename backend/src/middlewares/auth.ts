/**
 * Middleware xác thực (authentication) và chặn quyền theo vai trò.
 *
 * Vị trí trong luồng:
 *   Frontend gắn token vào header (api/axios.ts)
 *     -> `auth` ở đây kiểm tra token và gán req.user
 *     -> `adminOnly` / `requirePermission` chặn tiếp theo quyền
 *     -> Controller -> Service -> DB
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/prisma';

/** Phần dữ liệu được nhúng trong JWT khi đăng nhập (xem auth.service.ts -> login). */
export interface JwtPayload {
  id: number;
  username: string;
  role: string;
  fullName: string;
  permissionGroupId?: number | null;
}

// Khai báo bổ sung thuộc tính `user` vào kiểu Request của Express, để mọi controller
// dùng được `req.user?.id` mà TypeScript vẫn hiểu kiểu. Giá trị được middleware `auth`
// bên dưới gán vào.
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware xác thực — chốt chặn đầu tiên của mọi API cần đăng nhập.
 *
 * Các bước: đọc header `Authorization: Bearer <token>` -> verify chữ ký JWT ->
 * đọc lại user trong DB -> gán `req.user` cho các tầng sau dùng.
 *
 * Vì sao đã verify token rồi vẫn phải truy vấn DB: token có hạn 24h, nên nếu admin khoá
 * tài khoản (isActive = false) hoặc đổi vai trò trong khoảng đó, token cũ vẫn hợp lệ về
 * mặt chữ ký. Đọc lại DB đảm bảo quyền dùng luôn là quyền hiện tại, không phải quyền lúc
 * đăng nhập.
 */
export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Không có token xác thực' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        role: true,
        fullName: true,
        isActive: true,
        permissionGroupId: true,
      },
    });

    // Tài khoản đã bị xoá hoặc bị khoá sau khi token được cấp -> từ chối ngay.
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      permissionGroupId: user.permissionGroupId,
    };
    next();
  } catch {
    // jwt.verify ném lỗi khi token sai chữ ký, sai định dạng hoặc đã hết hạn — cả ba đều
    // là 401. Không trả chi tiết lỗi ra ngoài để tránh lộ thông tin cho người dò token.
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

/**
 * Middleware chặn theo vai trò: chỉ cho admin đi tiếp.
 *
 * Dùng cho các thao tác quản trị mà nhân viên không được đụng tới (sửa luật hệ chuyên gia,
 * quản lý người dùng, xoá danh mục...). Luôn đặt SAU `auth` trong chuỗi middleware vì nó
 * đọc `req.user` do `auth` gán.
 *
 * Phân quyền chi tiết theo từng màn hình thì dùng `requirePermission` (xem file cùng thư mục).
 */
export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ admin mới có quyền truy cập' });
    return;
  }
  next();
};
