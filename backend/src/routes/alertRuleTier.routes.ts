import { Router } from 'express';
import { alertRuleTierController } from '../controllers/alertRuleTier.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

// GET mở cho mọi user đã đăng nhập — các trang vận hành (VD: Xe ra) cần đọc ngưỡng để tô màu
// thời gian đỗ theo đúng mức độ đã cấu hình, không phải chỉ admin mới xem được.
router.get('/', auth, (req, res) => alertRuleTierController.list(req, res));
router.get('/rule-types', auth, (req, res) => alertRuleTierController.ruleTypes(req, res));
router.post('/', auth, adminOnly, (req, res) => alertRuleTierController.create(req, res));
router.put('/:id', auth, adminOnly, (req, res) => alertRuleTierController.update(req, res));
router.delete('/:id', auth, adminOnly, (req, res) => alertRuleTierController.delete(req, res));

export default router;
