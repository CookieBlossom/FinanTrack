import { Router } from 'express';
import userRoutes from './userRoutes';
import cardTypeRoutes from './cardTypeRoutes';
import cardRoutes from './cardRoutes';
import projectedMovementRoutes from './projectedMovementRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import goalRoutes from './goalRoutes';
import budgetRoutes from './budgetRoutes';
import scraperRoutes from './scraperRoutes';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.use('/users', userRoutes);

// Rutas protegidas (requieren autenticación)
router.use('/cards', cardRoutes, authMiddleware);
router.use('/card-types', cardTypeRoutes, authMiddleware);
router.use('/projected-movements', projectedMovementRoutes, authMiddleware);
router.use('/subscriptions', subscriptionRoutes, authMiddleware);
router.use('/goals', goalRoutes, authMiddleware);
router.use('/budgets', budgetRoutes, authMiddleware);
router.use('/scraper', scraperRoutes, authMiddleware);

// Ruta de prueba para verificar que el router está funcionando
router.get('/test', (req, res) => {
    res.json({ message: 'Router API funcionando correctamente' });
});

export default router; 