import { Router } from 'express';
import { CardTypeController } from '../controllers/CardTypeController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const cardTypeController = new CardTypeController();

// Middleware de autenticación para todas las rutas
router.use(authMiddleware);

// Obtener todos los tipos de tarjeta
router.get('/', cardTypeController.getAllCardTypes);

// Obtener un tipo de tarjeta por ID
router.get('/:id', cardTypeController.getCardTypeById);

// Crear un nuevo tipo de tarjeta
router.post('/', cardTypeController.createCardType);

// Actualizar un tipo de tarjeta
router.put('/:id', cardTypeController.updateCardType);

// Eliminar un tipo de tarjeta
router.delete('/:id', cardTypeController.deleteCardType);

export default router;

 