import { Router } from 'express';
import { expertRuleController } from '../controllers/expertRule.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/', auth, (req, res) => expertRuleController.list(req, res));
router.get('/domains', auth, (req, res) => expertRuleController.domains(req, res));
// Khuôn form nhập luật (dropdown + biến dùng được trong nội dung) — phải khai báo
// trước '/:id' nếu không Express sẽ hiểu "form-spec" là một id.
router.get('/form-spec', auth, (req, res) => expertRuleController.formSpec(req, res));
router.get('/:id', auth, (req, res) => expertRuleController.getById(req, res));
router.post('/', auth, adminOnly, (req, res) => expertRuleController.create(req, res));
router.put('/:id', auth, adminOnly, (req, res) => expertRuleController.update(req, res));
// Bật/tắt nhanh 1 luật — PATCH thay vì PUT vì chỉ đổi đúng 1 field, không cần gửi lại cả rule.
router.patch('/:id/enabled', auth, adminOnly, (req, res) => expertRuleController.setEnabled(req, res));
router.delete('/:id', auth, adminOnly, (req, res) => expertRuleController.delete(req, res));
router.post('/evaluate', auth, adminOnly, (req, res) => expertRuleController.evaluate(req, res));

export default router;
