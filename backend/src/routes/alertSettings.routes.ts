import { Router } from 'express';
import { alertSettingsController } from '../controllers/alertSettings.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

// GET mở cho mọi user đã đăng nhập — trang Xe ra cần đọc ngưỡng để tô màu thời gian đỗ.
router.get('/', auth, (req, res) => alertSettingsController.get(req, res));
router.put('/', auth, adminOnly, (req, res) => alertSettingsController.update(req, res));

export default router;
