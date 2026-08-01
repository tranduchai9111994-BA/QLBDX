import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));
router.post('/register', auth, adminOnly, validate(registerSchema), (req, res) => authController.register(req, res));
router.get('/me', auth, (req, res) => authController.getProfile(req, res));
router.put('/me', auth, (req, res) => authController.updateProfile(req, res));

export default router;
