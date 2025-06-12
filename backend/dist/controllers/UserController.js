"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
const errors_1 = require("../utils/errors");
class UserController {
    constructor() {
        this.register = async (req, res) => {
            try {
                console.log('Recibida petición de registro con body:', req.body);
                const userData = req.body;
                const user = await this.userService.register(userData);
                return res.status(201).json({
                    success: true,
                    message: 'Usuario registrado exitosamente',
                    data: user
                });
            }
            catch (error) {
                console.error('Error en el controlador durante el registro:', error);
                if (error instanceof errors_1.DatabaseError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                if (error instanceof errors_1.UserAlreadyExistsError) {
                    return res.status(409).json({ message: error.message });
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor'
                });
            }
        };
        this.login = async (req, res) => {
            try {
                const credentials = req.body;
                const result = await this.userService.login(credentials);
                console.log('Token generado para el usuario:', result.token);
                return res.status(200).json(result);
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    const errorMessage = error.message;
                    switch (errorMessage) {
                        case 'El usuario no existe':
                        case 'La contraseña es incorrecta':
                            return res.status(401).json({
                                success: false,
                                message: 'El correo electrónico o la contraseña son incorrectos'
                            });
                        case 'La cuenta está desactivada':
                            return res.status(403).json({
                                success: false,
                                message: 'Tu cuenta está desactivada. Por favor, contacta con soporte.'
                            });
                        case 'El correo electrónico y la contraseña son requeridos':
                            return res.status(400).json({
                                success: false,
                                message: errorMessage
                            });
                        default:
                            return res.status(500).json({
                                success: false,
                                message: 'Error interno del servidor'
                            });
                    }
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor'
                });
            }
        };
        this.getProfile = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                const user = await this.userService.getProfile(userId);
                return res.status(200).json(user);
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    return res.status(404).json({ message: error.message });
                }
                return res.status(500).json({ message: 'Internal server error' });
            }
        };
        this.updateProfile = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                const userData = req.body;
                const updatedUser = await this.userService.updateProfile(userId, userData);
                return res.status(200).json(updatedUser);
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    return res.status(400).json({ message: error.message });
                }
                return res.status(500).json({ message: 'Internal server error' });
            }
        };
        this.changePassword = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({ message: 'Unauthorized' });
                }
                const { currentPassword, newPassword } = req.body;
                if (!currentPassword || !newPassword) {
                    return res.status(400).json({ message: 'Current password and new password are required' });
                }
                await this.userService.changePassword(userId, currentPassword, newPassword);
                return res.status(200).json({ message: 'Password updated successfully' });
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    return res.status(400).json({ message: error.message });
                }
                return res.status(500).json({ message: 'Internal server error' });
            }
        };
        this.forgotPassword = async (req, res) => {
            try {
                const { email } = req.body;
                if (!email) {
                    return res.status(400).json({
                        success: false,
                        message: 'El email es requerido'
                    });
                }
                await this.userService.forgotPassword(email);
                return res.status(200).json({
                    success: true,
                    message: 'Se han enviado las instrucciones a tu correo electrónico'
                });
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor'
                });
            }
        };
        this.resetPassword = async (req, res) => {
            try {
                const { token, newPassword } = req.body;
                if (!token || !newPassword) {
                    return res.status(400).json({
                        success: false,
                        message: 'El token y la nueva contraseña son requeridos'
                    });
                }
                await this.userService.resetPassword(token, newPassword);
                return res.status(200).json({
                    success: true,
                    message: 'Contraseña actualizada exitosamente'
                });
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    return res.status(400).json({
                        success: false,
                        message: error.message
                    });
                }
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor'
                });
            }
        };
        this.userService = new user_service_1.UserService();
    }
}
exports.UserController = UserController;
//# sourceMappingURL=UserController.js.map