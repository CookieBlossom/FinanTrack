import { Router } from 'express';
import { CardTypeController } from '../controllers/CardTypeController';
const router = Router();
const cardTypeController = new CardTypeController();

// Obtener todos los tipos de tarjeta
router.get('/', cardTypeController.getAllCardTypes);

export default router;