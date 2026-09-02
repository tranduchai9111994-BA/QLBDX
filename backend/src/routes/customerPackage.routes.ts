/**
 * Định tuyến gói dịch vụ khách đã mua. Tiền tố: /api/customer-packages
 */
import { Router } from 'express';
import { customerPackageController } from '../controllers/customerPackage.controller';
import { validate } from '../middlewares/validate';
import { createCustomerPackageSchema, updateCustomerPackageSchema } from '../validators/customerPackage.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'customer-packages';

router.get('/', auth, (req, res) => customerPackageController.findAll(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('CustomerPackages'), validate(createCustomerPackageSchema), (req, res) => customerPackageController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('CustomerPackages'), validate(updateCustomerPackageSchema), (req, res) => customerPackageController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('CustomerPackages'), (req, res) => customerPackageController.delete(req, res));
router.get('/check/:vehicleId', auth, (req, res) => customerPackageController.checkActivePackage(req, res));
router.get('/recommend/:customerId', auth, (req, res) => customerPackageController.recommend(req, res));

export default router;
