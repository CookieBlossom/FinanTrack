"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const UserController_1 = require("../controllers/UserController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const userController = new UserController_1.UserController();
router.get('/', (req, res) => {
    res.json({ message: 'Rutas de usuarios configuradas' });
});
// rutas publicas
router.post('/register', (req, res, next) => {
    userController.register(req, res).catch(next);
});
router.post('/login', (req, res, next) => {
    userController.login(req, res).catch(next);
});
router.post('/forgot-password', (req, res, next) => {
    userController.forgotPassword(req, res).catch(next);
});
router.post('/reset-password', (req, res, next) => {
    userController.resetPassword(req, res).catch(next);
});
// rutas publicas con autenticacion
router.get('/profile', authMiddleware_1.authMiddleware, (req, res, next) => {
    console.log('Recibida petición de perfil para usuario:', req.user?.id);
    userController.getProfile(req, res).catch(next);
});
router.put('/profile', authMiddleware_1.authMiddleware, (req, res, next) => {
    console.log('Recibida petición de actualización de perfil para usuario:', req.user?.id);
    userController.updateProfile(req, res).catch(next);
});
router.put('/change-password', authMiddleware_1.authMiddleware, (req, res, next) => {
    console.log('Recibida petición de cambio de contraseña para usuario:', req.user?.id);
    userController.changePassword(req, res).catch(next);
});
console.log('Rutas de usuarios configuradas');
exports.default = router;
//# sourceMappingURL=userRoutes.js.map