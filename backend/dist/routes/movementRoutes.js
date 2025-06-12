"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
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
// Aplicar middleware de autenticación a todas las rutas de movimientos
router.use(authMiddleware_1.authMiddleware);
// Obtener todos los movimientos
router.get('/', movementController.getAll);
// Obtener movimientos filtrados
router.get('/filter', movementController.getByFilters);
// Obtener un movimiento por ID
router.get('/:id', movementController.getById);
// Crear un nuevo movimiento
router.post('/', movementController.create);
// Actualizar un movimiento
router.put('/:id', movementController.update);
// Eliminar un movimiento
router.delete('/:id', movementController.delete);
// Nueva ruta para procesar cartolas
router.post('/cartola', upload.single('cartola'), movementController.uploadCartola);
exports.default = router;
//# sourceMappingURL=movementRoutes.js.map