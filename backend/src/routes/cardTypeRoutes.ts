import { Router } from 'express';
import { CardTypeController } from '../controllers/CardTypeController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const cardTypeController = new CardTypeController();

router.use(authMiddleware);

// Obtener todos los tipos de tarjeta
router.get('/', cardTypeController.getAllCardTypes);

export default router;