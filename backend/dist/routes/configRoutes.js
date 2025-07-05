"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ConfigController_1 = require("../controllers/ConfigController");
const router = (0, express_1.Router)();
const configController = new ConfigController_1.ConfigController();
// Ruta para obtener la configuración de companies.json
router.get('/companies', configController.getCompanies);
exports.default = router;
//# sourceMappingURL=configRoutes.js.map