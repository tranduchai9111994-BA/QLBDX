import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { validate } from '../middlewares/validate';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.validator';
import { auth } from '../middlewares/auth';
import { requirePermission } from '../middlewares/requirePermission';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();
const SCREEN = 'customers';

// Xem (GET) mở cho mọi user đã đăng nhập — ma trận quyền theo yêu cầu chỉ có Thêm/Sửa/Xóa, dữ
// liệu tra cứu là phụ thuộc dùng chung của nhiều màn khác (VD dropdown khách hàng ở Đăng ký gói).
router.get('/', auth, (req, res) => customerController.findAll(req, res));
router.get('/:id', auth, (req, res) => customerController.findById(req, res));
router.post('/', auth, requirePermission(SCREEN, 'create'), activityLogger('Customers'), validate(createCustomerSchema), (req, res) => customerController.create(req, res));
router.put('/:id', auth, requirePermission(SCREEN, 'update'), activityLogger('Customers'), validate(updateCustomerSchema), (req, res) => customerController.update(req, res));
router.delete('/:id', auth, requirePermission(SCREEN, 'delete'), activityLogger('Customers'), (req, res) => customerController.delete(req, res));

export default router;
