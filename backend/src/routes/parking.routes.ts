import { Router } from 'express';
import { parkingController } from '../controllers/parking.controller';
import { validate } from '../middlewares/validate';
import {
  parkingEntrySchema,
  parkingExitExceptionSchema,
  parkingExitSchema,
} from '../validators/parking.validator';
import { auth } from '../middlewares/auth';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();

router.get('/', auth, (req, res) => parkingController.findAll(req, res));
router.get('/history', auth, (req, res) => parkingController.history(req, res));
router.get('/plate-history/:plate', auth, (req, res) => parkingController.plateHistory(req, res));
router.get('/smart-lookup/:plate', auth, (req, res) => parkingController.smartLookup(req, res));
router.post('/entry', auth, activityLogger('ParkingRecords'), validate(parkingEntrySchema), (req, res) => parkingController.entry(req, res));
router.post('/exit', auth, activityLogger('ParkingRecords'), validate(parkingExitSchema), (req, res) => parkingController.exit(req, res));
router.post('/exit-exception', auth, activityLogger('ParkingRecords'), validate(parkingExitExceptionSchema), (req, res) => parkingController.exitException(req, res));
router.get('/:id/preview', auth, (req, res) => parkingController.preview(req, res));

export default router;
