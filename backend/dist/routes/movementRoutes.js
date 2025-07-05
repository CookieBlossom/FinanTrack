"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MovementController_1 = require("../controllers/MovementController");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const movementController = new MovementController_1.MovementController();
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
// Las rutas aquí ya están protegidas por authMiddleware desde routes/index.ts
router.get('/', movementController.getAll);
router.get('/cash', movementController.getCashMovements);
router.get('/card-movements', movementController.getCardMovements);
router.get('/filter', movementController.getByFilters);
router.post('/filter', movementController.getByFilters); // Agregar ruta POST para filtros
router.get('/monthly-summary', movementController.getMonthlySummary);
router.get('/:id', movementController.getById);
router.post('/', movementController.create);
router.put('/:id', movementController.update);
router.delete('/:id', movementController.delete);
router.post('/cartola', upload.single('cartola'), movementController.uploadCartola);
exports.default = router;
//# sourceMappingURL=movementRoutes.js.map