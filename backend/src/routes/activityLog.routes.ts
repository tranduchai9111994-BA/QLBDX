/**
 * Định tuyến nhật ký hoạt động. Tiền tố: /api/activity-logs
 */
import { Router } from 'express';
import { activityLogController } from '../controllers/activityLog.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/', auth, adminOnly, (req, res) => activityLogController.findAll(req, res));

export default router;
