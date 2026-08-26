import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/', auth, adminOnly, (req, res) => paymentController.findAll(req, res));
router.get('/my-shift', auth, (req, res) => paymentController.myShift(req, res));

export default router;
