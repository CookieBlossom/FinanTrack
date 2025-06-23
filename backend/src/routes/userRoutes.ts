import { Router, Request, Response, NextFunction } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { AuthRequest } from '../interfaces/AuthRequest';

const router = Router();
const userController = new UserController();

router.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Rutas de usuarios configuradas' });
});

// rutas publicas
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
    userController.register(req as AuthRequest, res).catch(next);
});

router.post('/check-email', (req: Request, res: Response, next: NextFunction) => {
    userController.checkEmailExists(req as AuthRequest, res).catch(next);
});

router.post('/login', (req: Request, res: Response, next: NextFunction) => {
    userController.login(req as AuthRequest, res).catch(next);
});

router.post('/forgot-password', (req: Request, res: Response, next: NextFunction) => {
    userController.forgotPassword(req as AuthRequest, res).catch(next);
});

router.post('/reset-password', (req: Request, res: Response, next: NextFunction) => {
    userController.resetPassword(req as AuthRequest, res).catch(next);
});

// rutas con autenticacion
router.get('/profile', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    console.log('Recibida petición de perfil para usuario:', authReq.user?.id);
    userController.getProfile(authReq, res).catch(next);
});

router.put('/profile', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    console.log('Recibida petición de actualización de perfil para usuario:', authReq.user?.id);
    userController.updateProfile(authReq, res).catch(next);
});

router.put('/change-password', authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    console.log('Recibida petición de cambio de contraseña para usuario:', authReq.user?.id);
    userController.changePassword(authReq, res).catch(next);
});

export default router; 