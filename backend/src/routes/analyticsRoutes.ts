import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';

const router = Router();
const analyticsController = new AnalyticsController();

// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/', analyticsController.getAnalytics);

export default router; 