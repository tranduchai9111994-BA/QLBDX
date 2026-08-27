import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';

/**
 * Chặn API thật theo nhóm quyền — khác với permConfig.ts phía frontend cũ (chỉ ẩn/hiện UI,
 * lưu localStorage, backend không biết gì). Admin luôn qua (bypass hoàn toàn). Staff: tra
 * GroupPermission theo (permissionGroupId, screenKey), thiếu group hoặc thiếu dòng quyền
 * cho đúng screenKey đó → mặc định TỪ CHỐI (deny-by-default, không phải allow-by-default).
 */
export const requirePermission = (screenKey: string, action: PermissionAction) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Chưa đăng nhập' });
      return;
    }
    if (req.user.role === 'admin') {
      next();
      return;
    }
    if (!req.user.permissionGroupId) {
      res.status(403).json({ message: 'Tài khoản chưa được gán nhóm quyền — liên hệ quản trị viên' });
      return;
    }

    const perm = await prisma.groupPermission.findUnique({
      where: { groupId_screenKey: { groupId: req.user.permissionGroupId, screenKey } },
    });

    const allowed = perm
      ? action === 'view'
        ? perm.canView
        : action === 'create'
          ? perm.canCreate
          : action === 'update'
            ? perm.canUpdate
            : perm.canDelete
      : false;

    if (!allowed) {
      res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
      return;
    }
    next();
  };
};
