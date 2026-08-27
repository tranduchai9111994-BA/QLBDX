import { Router } from 'express';
import { parkingZoneController } from '../controllers/parkingZone.controller';
import { validate } from '../middlewares/validate';
import { createParkingZoneSchema, updateParkingZoneSchema } from '../validators/parkingZone.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
// Khu vực gộp chung màn "Bãi đỗ xe" (parking-spots) với chỗ đỗ ở frontend — dùng chung 1
// screenKey để 1 nhóm quyền quản lý cả 2, không tách riêng "Khu vực" trong ma trận.
const SCREEN = 'parking-spots';

router.get('/', auth, (req, res) => parkingZoneController.findAll(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('ParkingZones'), validate(createParkingZoneSchema), (req, res) => parkingZoneController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('ParkingZones'), validate(updateParkingZoneSchema), (req, res) => parkingZoneController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('ParkingZones'), (req, res) => parkingZoneController.delete(req, res));

export default router;
