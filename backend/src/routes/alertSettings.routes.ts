import { Router } from 'express';
import { alertSettingsController } from '../controllers/alertSettings.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/', auth, adminOnly, (req, res) => alertSettingsController.get(req, res));
router.put('/', auth, adminOnly, (req, res) => alertSettingsController.update(req, res));

export default router;
