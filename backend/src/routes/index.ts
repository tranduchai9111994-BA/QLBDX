import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import customerRoutes from './customer.routes';
import vehicleRoutes from './vehicle.routes';
import vehicleTypeRoutes from './vehicleType.routes';
import packageRoutes from './package.routes';
import customerPackageRoutes from './customerPackage.routes';
import parkingRoutes from './parking.routes';
import parkingZoneRoutes from './parkingZone.routes';
import parkingSpotRoutes from './parkingSpot.routes';
import paymentRoutes from './payment.routes';
import reportRoutes from './report.routes';
import activityLogRoutes from './activityLog.routes';
import analyticsRoutes from './analytics.routes';
import alertSettingsRoutes from './alertSettings.routes';
import alertRuleTierRoutes from './alertRuleTier.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/vehicle-types', vehicleTypeRoutes);
router.use('/packages', packageRoutes);
router.use('/customer-packages', customerPackageRoutes);
router.use('/parking', parkingRoutes);
router.use('/parking-zones', parkingZoneRoutes);
router.use('/parking-spots', parkingSpotRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/alert-settings', alertSettingsRoutes);
router.use('/alert-rule-tiers', alertRuleTierRoutes);

export default router;
