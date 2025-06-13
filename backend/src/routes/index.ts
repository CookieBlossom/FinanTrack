import { Router } from 'express';
import userRoutes from './userRoutes';
import cardTypeRoutes from './cardTypeRoutes';
import cardRoutes from './cardRoutes';
import projectedMovementRoutes from './projectedMovementRoutes';
import scraperRoutes from './scraperRoutes';
import dashboardRoutes from './dashboardRoutes';
import analyticsRoutes from './analyticsRoutes';
import cartolaRoutes from './cartola.routes';
import { authMiddleware } from '../middlewares/authMiddleware';
import bankRoutes from './bankRoutes';
import movementRoutes from './movementRoutes';
import categoryRoutes from './categoryRoutes';

const router = Router();
const protectedRouter = Router();
// Rutas públicas (no requieren autenticación)
router.use('/users', userRoutes);
// Aplicar middleware de autenticación a todas las rutas protegidas
protectedRouter.use(authMiddleware);
// Ruta de prueba para verificar que el router está funcionando
router.get('/', (req, res) => {
    res.json({ message: 'backend funcionando correctamente' });
});
router.get('/health', (req, res) => {
    res.json({ message: 'backend funcionando correctamente' });
});
// Rutas protegidas (requieren autenticación)

protectedRouter.use('/cards', cardRoutes);
protectedRouter.use('/cartolas', cartolaRoutes);
protectedRouter.use('/card-types', cardTypeRoutes);
protectedRouter.use('/categories', categoryRoutes);
protectedRouter.use('/projected-movements', projectedMovementRoutes);
protectedRouter.use('/scraper', scraperRoutes);
protectedRouter.use('/dashboard', dashboardRoutes);
protectedRouter.use('/analytics', analyticsRoutes);
protectedRouter.use('/banks', bankRoutes);
protectedRouter.use('/movements', movementRoutes);

export default router; 