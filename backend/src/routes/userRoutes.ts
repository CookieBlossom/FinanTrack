import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { AuthRequest } from '../interfaces/IAuth';

const router = Router();
const userController = new UserController();

router.get('/', (req, res) => {
    res.json({ message: 'Rutas de usuarios configuradas' });
});
// rutas publicas
router.post('/register', (req, res, next) => {
    console.log('Recibida petición de registro:', req.body);
    userController.register(req, res).catch(next);
});

router.post('/login', (req, res, next) => {
    console.log('Recibida petición de login:', { email: req.body.email });
    userController.login(req, res).catch(next);
});

// rutas publicas con autenticacion
router.get('/profile', authMiddleware, (req: AuthRequest, res, next) => {
    console.log('Recibida petición de perfil para usuario:', req.user?.id);
    userController.getProfile(req, res).catch(next);
});

router.put('/profile', authMiddleware, (req: AuthRequest, res, next) => {
    console.log('Recibida petición de actualización de perfil para usuario:', req.user?.id);
    userController.updateProfile(req, res).catch(next);
});

router.put('/change-password', authMiddleware, (req: AuthRequest, res, next) => {
    console.log('Recibida petición de cambio de contraseña para usuario:', req.user?.id);
    userController.changePassword(req, res).catch(next);
});

console.log('Rutas de usuarios configuradas');

export default router; 