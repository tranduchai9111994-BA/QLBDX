import { Router } from 'express';
import { vehicleController } from '../controllers/vehicle.controller';
import { validate } from '../middlewares/validate';
import { createVehicleSchema, updateVehicleSchema } from '../validators/vehicle.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'vehicles';

// Xem (GET) mở cho mọi user đã đăng nhập — xem lý do ở customer.routes.ts.
router.get('/', auth, (req, res) => vehicleController.findAll(req, res));
router.get('/by-plate/:plate', auth, (req, res) => vehicleController.findByPlate(req, res));
router.get('/:id', auth, (req, res) => vehicleController.findById(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('Vehicles'), validate(createVehicleSchema), (req, res) => vehicleController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('Vehicles'), validate(updateVehicleSchema), (req, res) => vehicleController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('Vehicles'), (req, res) => vehicleController.delete(req, res));

export default router;
