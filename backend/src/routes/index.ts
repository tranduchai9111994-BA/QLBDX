/**
 * Bảng định tuyến gốc của API — gom toàn bộ route con lại một chỗ.
 *
 * Vị trí trong luồng: server.ts gắn router này vào tiền tố `/api`, nên một khai báo
 * `router.use('/parking', ...)` ở đây tương ứng với URL thật là `/api/parking/...`.
 *
 * Muốn tìm code xử lý của một API bất kỳ thì đi theo đúng chuỗi này:
 *   URL -> routes/*.routes.ts -> controllers/*.controller.ts -> services/*.service.ts -> Prisma -> DB
 */
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
import permissionGroupRoutes from './permissionGroup.routes';
import expertRuleRoutes from './expertRule.routes';

const router = Router();

// ── Tài khoản & phân quyền ──────────────────────────────────────────────────
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// ── Danh mục nghiệp vụ ──────────────────────────────────────────────────────
router.use('/customers', customerRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/vehicle-types', vehicleTypeRoutes);
router.use('/packages', packageRoutes);
router.use('/customer-packages', customerPackageRoutes);

// ── Vận hành: xe vào / xe ra / sơ đồ bãi / thanh toán ───────────────────────
router.use('/parking', parkingRoutes);
router.use('/parking-zones', parkingZoneRoutes);
router.use('/parking-spots', parkingSpotRoutes);
router.use('/payments', paymentRoutes);

// ── Báo cáo, phân tích, cảnh báo và hệ chuyên gia ───────────────────────────
router.use('/reports', reportRoutes);
router.use('/activity-logs', activityLogRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/alert-settings', alertSettingsRoutes);
router.use('/alert-rule-tiers', alertRuleTierRoutes);
router.use('/permission-groups', permissionGroupRoutes);
router.use('/expert-rules', expertRuleRoutes);

export default router;
