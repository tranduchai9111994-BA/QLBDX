import { Router } from 'express';
import { permissionGroupController } from '../controllers/permissionGroup.controller';
import { auth, adminOnly } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { activityLogger } from '../middlewares/activityLogger';
import {
  createPermissionGroupSchema,
  setPermissionsSchema,
  updatePermissionGroupSchema,
} from '../validators/permissionGroup.validator';

const router = Router();

// Toàn bộ route chỉ admin — quản lý nhóm quyền là hành động cấu hình hệ thống, không phải
// dữ liệu vận hành mà staff cần đọc (khác alertRuleTier ở trên).
router.get('/screens', auth, adminOnly, (req, res) => permissionGroupController.screens(req, res));
router.get('/', auth, adminOnly, (req, res) => permissionGroupController.findAll(req, res));
router.get('/:id', auth, adminOnly, (req, res) => permissionGroupController.findOne(req, res));
router.post('/', auth, adminOnly, activityLogger('PermissionGroups'), validate(createPermissionGroupSchema), (req, res) => permissionGroupController.create(req, res));
router.put('/:id', auth, adminOnly, activityLogger('PermissionGroups'), validate(updatePermissionGroupSchema), (req, res) => permissionGroupController.update(req, res));
router.delete('/:id', auth, adminOnly, activityLogger('PermissionGroups'), (req, res) => permissionGroupController.delete(req, res));
router.put('/:id/permissions', auth, adminOnly, activityLogger('PermissionGroups'), validate(setPermissionsSchema), (req, res) => permissionGroupController.setPermissions(req, res));

export default router;
