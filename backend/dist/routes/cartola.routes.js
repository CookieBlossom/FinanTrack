"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CartolaController_1 = require("../controllers/CartolaController");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const cartolaController = new CartolaController_1.CartolaController();
// Configurar multer para manejar archivos PDF
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // Límite de 5MB
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(null, false);
            cb(new Error('Solo se permiten archivos PDF'));
        }
    },
});
// Ruta para subir cartola
router.post('/upload', upload.single('cartola'), cartolaController.uploadCartola);
exports.default = router;
//# sourceMappingURL=cartola.routes.js.map