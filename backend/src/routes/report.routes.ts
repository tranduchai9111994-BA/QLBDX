import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/dashboard', auth, adminOnly, (req, res) => reportController.getDashboard(req, res));
router.get('/alerts', auth, adminOnly, (req, res) => reportController.getAlerts(req, res));
router.get('/revenue', auth, adminOnly, (req, res) => reportController.getRevenue(req, res));
router.get('/vehicle-stats', auth, adminOnly, (req, res) => reportController.getVehicleStats(req, res));
router.get('/hourly-stats', auth, adminOnly, (req, res) => reportController.getHourlyStats(req, res));

export default router;
