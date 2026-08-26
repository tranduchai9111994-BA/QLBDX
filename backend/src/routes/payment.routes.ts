import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { auth, adminOnly } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { updatePaymentSchema } from '../validators/payment.validator';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();

router.get('/', auth, adminOnly, (req, res) => paymentController.findAll(req, res));
router.get('/my-shift', auth, (req, res) => paymentController.myShift(req, res));
router.put('/:id', auth, adminOnly, activityLogger('Payments'), validate(updatePaymentSchema), (req, res) => paymentController.update(req, res));

export default router;
