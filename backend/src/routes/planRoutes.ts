import { Router } from 'express';
import { PlanController } from '../controllers/PlanController';

const router = Router();
const controller = new PlanController();

router.get('/', controller.getPlan);
router.get('/limits', controller.getLimits);
router.get('/permissions', controller.getPermissions);
router.get('/usage', controller.getUsage);

export default router; 