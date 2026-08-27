import { Router } from 'express';
import { vehicleTypeController } from '../controllers/vehicleType.controller';
import { validate } from '../middlewares/validate';
import { createVehicleTypeSchema, scheduleRateChangeSchema, updateVehicleTypeSchema } from '../validators/vehicleType.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'vehicle-types';

// Xem (GET) mở cho mọi user đã đăng nhập — Xe vào/Xe ra cần đọc danh sách loại xe cho dropdown,
// không phụ thuộc ma trận quyền (ma trận theo yêu cầu chỉ có Thêm/Sửa/Xóa, không có cột Xem).
router.get('/', auth, (req, res) => vehicleTypeController.findAll(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('VehicleTypes'), validate(createVehicleTypeSchema), (req, res) => vehicleTypeController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('VehicleTypes'), validate(updateVehicleTypeSchema), (req, res) => vehicleTypeController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('VehicleTypes'), (req, res) => vehicleTypeController.delete(req, res));
router.post('/:id/rate-changes', auth, requirePermission(SCREEN, 'update'), activityLogger('VehicleTypeRateHistory'), validate(scheduleRateChangeSchema), (req, res) => vehicleTypeController.scheduleRateChange(req, res));
router.get('/:id/rate-changes', auth, (req, res) => vehicleTypeController.getRateHistory(req, res));

export default router;
