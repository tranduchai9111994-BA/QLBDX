import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { auth, adminOnly } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';

const router = Router();

// /alerts thuộc màn "Cảnh báo" (screenKey riêng); các endpoint còn lại thuộc màn "Báo cáo thống kê".
// dashboard/insights hiện chỉ MgmtDashboard (admin) dùng nên vẫn giữ adminOnly như cũ.
router.get('/dashboard', auth, adminOnly, (req, res) => reportController.getDashboard(req, res));
router.get('/insights', auth, adminOnly, (req, res) => reportController.getInsights(req, res));
router.get('/alerts', auth, requirePermission('alerts', 'view'), (req, res) => reportController.getAlerts(req, res));
router.get('/revenue', auth, requirePermission('reports', 'view'), (req, res) => reportController.getRevenue(req, res));
router.get('/vehicle-stats', auth, requirePermission('reports', 'view'), (req, res) => reportController.getVehicleStats(req, res));
router.get('/hourly-stats', auth, requirePermission('reports', 'view'), (req, res) => reportController.getHourlyStats(req, res));
router.get('/payment-methods', auth, requirePermission('reports', 'view'), (req, res) => reportController.getPaymentMethodStats(req, res));
router.get('/exception-stats', auth, requirePermission('reports', 'view'), (req, res) => reportController.getExceptionStats(req, res));

export default router;
