import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscriptionController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const subscriptionController = new SubscriptionController();

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware);

// Obtener todas las suscripciones
router.get('/', subscriptionController.getAll);

// Obtener suscripciones por filtros
router.get('/filter', subscriptionController.getByFilters);

// Obtener una suscripción por ID
router.get('/:id', subscriptionController.getById);

// Crear una nueva suscripción
router.post('/', subscriptionController.create);

// Actualizar una suscripción
router.put('/:id', subscriptionController.update);

// Eliminar una suscripción
router.delete('/:id', subscriptionController.delete);

// Actualizar la fecha del próximo cobro
router.put('/:id/next-billing-date', subscriptionController.updateNextBillingDate);

export default router; 