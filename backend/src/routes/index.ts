import { Router } from 'express';
import userRoutes from './userRoutes';
import cardTypeRoutes from './cardTypeRoutes';
import cardRoutes from './cardRoutes';
import projectedMovementRoutes from './projectedMovementRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import goalRoutes from './goalRoutes';
import budgetRoutes from './budgetRoutes';
import scraperRoutes from './scraperRoutes';

const router = Router();

router.use('/users', userRoutes);
router.use('/card-types', cardTypeRoutes);
router.use('/cards', cardRoutes);
router.use('/projected-movements', projectedMovementRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/goals', goalRoutes);
router.use('/budgets', budgetRoutes);
router.use('/scraper', scraperRoutes);

export default router; 