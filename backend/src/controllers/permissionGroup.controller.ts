/**
 * Controller nhóm quyền (/api/permission-groups).
 *
 * Nhóm quyền là ma trận "màn hình x hành động (xem/thêm/sửa/xoá)" gán cho nhân viên.
 * Việc chặn thật khi gọi API nằm ở middlewares/requirePermission.ts — dữ liệu ở đây chỉ là
 * cấu hình mà middleware đó tra cứu.
 */
import { Request, Response } from 'express';
import { permissionGroupService } from '../services/permissionGroup.service';

export class PermissionGroupController {
  screens(_req: Request, res: Response): void {
    res.json(permissionGroupService.screens());
  }

  async findAll(_req: Request, res: Response): Promise<void> {
    try {
      const result = await permissionGroupService.findAll();
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async findOne(req: Request, res: Response): Promise<void> {
    try {
      const result = await permissionGroupService.findOne(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await permissionGroupService.create(req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const result = await permissionGroupService.update(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const result = await permissionGroupService.delete(Number(req.params.id));
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }

  async setPermissions(req: Request, res: Response): Promise<void> {
    try {
      const result = await permissionGroupService.setPermissions(Number(req.params.id), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ message: err.message || 'Lỗi server' });
    }
  }
}

export const permissionGroupController = new PermissionGroupController();
