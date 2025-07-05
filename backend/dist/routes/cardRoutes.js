"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CardController_1 = require("../controllers/CardController");
// import { authMiddleware } from '../middlewares/authMiddleware'; // authMiddleware ya se aplica en index.ts para /cards
const router = (0, express_1.Router)();
const cardController = new CardController_1.CardController();
// Las rutas aquí ya están bajo /cards y protegidas por authMiddleware desde routes/index.ts
// router.use(authMiddleware); // Comentado, ya que se aplica en el index.ts
// Rutas de tarjetas
router.get('/', cardController.getAllCards);
// Rutas específicas deben ir ANTES de las rutas con parámetros
router.get('/total-balance', cardController.getTotalBalanceByUserId);
router.post('/sync', cardController.syncCardsFromUser);
// Rutas con parámetros van DESPUÉS
router.get('/:id', cardController.getCardById);
router.post('/', cardController.createCard);
router.put('/:id', cardController.updateCard);
router.delete('/:id', cardController.deleteCard);
// Ruta especial para actualizar saldo
router.patch('/:id/balance', cardController.updateBalance);
exports.default = router;
//# sourceMappingURL=cardRoutes.js.map