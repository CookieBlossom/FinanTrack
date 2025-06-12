import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const analyticsController = new AnalyticsController();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener datos de analytics
// router.get('/', (req, res) => analyticsController.getAnalyticsData(req, res));

export default router; 