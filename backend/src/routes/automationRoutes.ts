import { Router } from 'express';
import { AutomationController } from '../controllers/AutomationController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();
const automationController = new AutomationController();

// Rutas públicas (para cron jobs)
router.post('/run-scheduled', automationController.runScheduledProcessing);

// Rutas protegidas (requieren autenticación)
router.use(authMiddleware);

// Obtener estadísticas de automatización
router.get('/stats', automationController.getStats);

// Procesar movimientos del usuario actual
router.post('/process-user', automationController.processUserMovements);


export default router; 