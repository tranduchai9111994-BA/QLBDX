import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/insights', auth, adminOnly, (req, res) => analyticsController.getInsights(req, res));

export default router;
