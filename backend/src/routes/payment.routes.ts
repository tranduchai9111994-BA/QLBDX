import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { validate } from '../middlewares/validate';
import { updatePaymentSchema } from '../validators/payment.validator';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'payments';

// Khác các màn tra cứu dùng chung (customers/vehicles/...), Thanh toán là dữ liệu tài chính nhạy
// cảm — trước đây admin-only tuyệt đối kể cả xem. Nay mở cho staff thuộc nhóm được cấp quyền
// (canView luôn true khi nhóm có ít nhất 1 dòng quyền cho màn này, xem permissionGroup.service.ts).
router.get('/', auth, requirePermission(SCREEN, 'view'), (req, res) => paymentController.findAll(req, res));
router.get('/my-shift', auth, (req, res) => paymentController.myShift(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('Payments'), validate(updatePaymentSchema), (req, res) => paymentController.update(req, res));

export default router;
