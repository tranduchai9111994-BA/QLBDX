import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/prisma';

export interface JwtPayload {
  id: number;
  username: string;
  role: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

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
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: 'Tài khoản không còn hiệu lực' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    };
    next();
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

export const adminOnly = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Chỉ admin mới có quyền truy cập' });
    return;
  }
  next();
};
