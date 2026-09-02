/**
 * Định tuyến quản lý tài khoản. Tiền tố: /api/users
 * Mọi route đều đi qua `auth` + `adminOnly` — nhân viên không truy cập được nhóm API này.
 */
import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { validate } from '../middlewares/validate';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';
import { auth, adminOnly } from '../middlewares/auth';
import { activityLogger } from '../middlewares/activityLogger';

const router = Router();

router.get('/', auth, adminOnly, (req, res) => userController.findAll(req, res));
router.get('/:id', auth, adminOnly, (req, res) => userController.findById(req, res));
router.post('/', auth, adminOnly, activityLogger('Users'), validate(createUserSchema), (req, res) => userController.create(req, res));
router.put('/:id', auth, adminOnly, activityLogger('Users'), validate(updateUserSchema), (req, res) => userController.update(req, res));
router.delete('/:id', auth, adminOnly, activityLogger('Users'), (req, res) => userController.delete(req, res));

export default router;
