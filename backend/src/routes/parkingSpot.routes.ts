/**
 * Định tuyến chỗ đỗ. Tiền tố: /api/parking-spots
 */
import { Router } from 'express';
import { parkingSpotController } from '../controllers/parkingSpot.controller';
import { validate } from '../middlewares/validate';
import { createParkingSpotSchema, updateParkingSpotSchema } from '../validators/parkingSpot.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'parking-spots';

router.get('/', auth, (req, res) => parkingSpotController.findAll(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('ParkingSpots'), validate(createParkingSpotSchema), (req, res) => parkingSpotController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('ParkingSpots'), validate(updateParkingSpotSchema), (req, res) => parkingSpotController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('ParkingSpots'), (req, res) => parkingSpotController.delete(req, res));

export default router;
