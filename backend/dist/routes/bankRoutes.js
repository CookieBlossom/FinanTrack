"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const BankController_1 = require("../controllers/BankController");
const router = (0, express_1.Router)();
const bankController = new BankController_1.BankController();
// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/', bankController.getAllBanks);
exports.default = router;
//# sourceMappingURL=bankRoutes.js.map