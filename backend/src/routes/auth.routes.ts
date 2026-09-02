/**
 * Định tuyến nhóm API tài khoản. Tiền tố đầy đủ: /api/auth
 *
 * Đọc mỗi dòng theo thứ tự: đường dẫn -> các middleware chạy lần lượt -> controller xử lý.
 */
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

// Đăng nhập là API DUY NHẤT trong file này không có middleware `auth` — vì lúc này người dùng
// chưa có token. `validate(loginSchema)` chặn sẵn body thiếu username/password.
router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));

// Tạo tài khoản nhân viên: phải đăng nhập (auth) VÀ phải là admin (adminOnly). Thứ tự middleware
// quan trọng — adminOnly đọc req.user do auth gán, nên auth bắt buộc đứng trước.
router.post('/register', auth, adminOnly, validate(registerSchema), (req, res) => authController.register(req, res));

// Hồ sơ của chính mình: chỉ cần đăng nhập, không phân biệt vai trò.
router.get('/me', auth, (req, res) => authController.getProfile(req, res));
router.put('/me', auth, (req, res) => authController.updateProfile(req, res));

export default router;
