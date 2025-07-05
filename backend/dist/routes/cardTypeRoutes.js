"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CardTypeController_1 = require("../controllers/CardTypeController");
const router = (0, express_1.Router)();
const cardTypeController = new CardTypeController_1.CardTypeController();
// Obtener todos los tipos de tarjeta
router.get('/', cardTypeController.getAllCardTypes);
exports.default = router;
//# sourceMappingURL=cardTypeRoutes.js.map