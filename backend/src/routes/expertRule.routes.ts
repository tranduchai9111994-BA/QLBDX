import { Router } from 'express';
import { expertRuleController } from '../controllers/expertRule.controller';
import { auth, adminOnly } from '../middlewares/auth';

const router = Router();

router.get('/', auth, (req, res) => expertRuleController.list(req, res));
router.get('/domains', auth, (req, res) => expertRuleController.domains(req, res));
router.get('/:id', auth, (req, res) => expertRuleController.getById(req, res));
router.post('/', auth, adminOnly, (req, res) => expertRuleController.create(req, res));
router.put('/:id', auth, adminOnly, (req, res) => expertRuleController.update(req, res));
router.delete('/:id', auth, adminOnly, (req, res) => expertRuleController.delete(req, res));
router.post('/evaluate', auth, adminOnly, (req, res) => expertRuleController.evaluate(req, res));

export default router;
