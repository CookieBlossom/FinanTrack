"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const BankController_1 = require("../controllers/BankController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const bankController = new BankController_1.BankController();
router.use(authMiddleware_1.authMiddleware);
// Obtener todos los bancos
router.get('/', bankController.getAllBanks);
exports.default = router;
//# sourceMappingURL=bankRoutes.js.map