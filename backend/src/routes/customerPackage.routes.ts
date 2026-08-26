import { Router } from 'express';
import { customerPackageController } from '../controllers/customerPackage.controller';
import { validate } from '../middlewares/validate';
import { createCustomerPackageSchema, updateCustomerPackageSchema } from '../validators/customerPackage.validator';
import { auth, adminOnly } from '../middlewares/auth';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();

router.get('/', auth, (req, res) => customerPackageController.findAll(req, res));
router.post('/', auth, activityLogger('CustomerPackages'), validate(createCustomerPackageSchema), (req, res) => customerPackageController.create(req, res));
router.put('/:id', auth, adminOnly, activityLogger('CustomerPackages'), validate(updateCustomerPackageSchema), (req, res) => customerPackageController.update(req, res));
router.delete('/:id', auth, adminOnly, activityLogger('CustomerPackages'), (req, res) => customerPackageController.delete(req, res));
router.get('/check/:vehicleId', auth, (req, res) => customerPackageController.checkActivePackage(req, res));
router.get('/recommend/:customerId', auth, (req, res) => customerPackageController.recommend(req, res));

export default router;
