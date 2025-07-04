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
import planRoutes from './planRoutes';
import plansPageRoutes from './plansPageRoutes';
import stripeRoutes from './stripeRoutes';
import automationRoutes from './automationRoutes';
import configRoutes from './configRoutes';
import { DashboardController } from '../controllers/DashboardController';

const router = Router();
const protectedRouter = Router();
const dashboardController = new DashboardController();

// Rutas públicas (no requieren autenticación)
router.use('/users', userRoutes);
router.use('/plans-page', plansPageRoutes);
router.use('/stripe', stripeRoutes);
router.use('/automation', automationRoutes);
router.use('/config', configRoutes);

// Ruta especial SOLO para el scraper Python (sin autenticación)
router.post('/scraper/process-data', dashboardController.processScraperData);

router.get('/', (req, res) => {
    res.json({ message: 'rutas publicas funcionando correctamente' });
});

// Rutas protegidas (requieren autenticación)

// Aplicar middleware de autenticación a todas las rutas protegidas
protectedRouter.use(authMiddleware);

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
protectedRouter.use('/plans', planRoutes);

// (opcional) ruta de prueba protegida  
protectedRouter.get('/', (req, res) => {
    res.json({ message: 'rutas protegidas funcionando correctamente' });
  });
  
router.use('/', protectedRouter);
export default router; 