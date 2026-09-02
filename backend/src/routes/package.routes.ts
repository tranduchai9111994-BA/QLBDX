/**
 * Định tuyến danh mục gói dịch vụ. Tiền tố: /api/packages
 */
import { Router } from 'express';
import { packageController } from '../controllers/package.controller';
import { validate } from '../middlewares/validate';
import { createPackageSchema, schedulePriceChangeSchema, updatePackageSchema } from '../validators/package.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'packages';

router.get('/', auth, (req, res) => packageController.findAll(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('ParkingPackages'), validate(createPackageSchema), (req, res) => packageController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('ParkingPackages'), validate(updatePackageSchema), (req, res) => packageController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('ParkingPackages'), (req, res) => packageController.delete(req, res));
router.post('/:id/price-changes', auth, requirePermission(SCREEN, 'update'), activityLogger('PackagePriceHistory'), validate(schedulePriceChangeSchema), (req, res) => packageController.schedulePriceChange(req, res));
router.get('/:id/price-changes', auth, (req, res) => packageController.getPriceHistory(req, res));

export default router;
