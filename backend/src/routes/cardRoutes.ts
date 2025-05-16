import { Router } from 'express';
import { CardController } from '../controllers/CardController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const cardController = new CardController();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Rutas de tarjetas
router.get('/', cardController.getAllCards);
router.get('/:id', cardController.getCardById);
router.post('/', cardController.createCard);
router.put('/:id', cardController.updateCard);
router.delete('/:id', cardController.deleteCard);

// Ruta especial para actualizar saldo
router.patch('/:id/balance', cardController.updateBalance);

export default router; 