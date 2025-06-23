import { Router } from 'express';
import { PlansPageController } from '../controllers/PlansPageController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';

const router = Router();
const controller = new PlansPageController();

// Rutas públicas (no requieren autenticación)
router.get('/plans', controller.getPlansInfo);

// Ruta que verifica autenticación opcional
router.get('/auth-status', optionalAuthMiddleware, controller.checkAuthStatus);

// Rutas protegidas (requieren autenticación)
router.post('/initiate-payment', authMiddleware, controller.initiatePayment);
router.post('/confirm-payment', authMiddleware, controller.confirmPayment);

export default router; 