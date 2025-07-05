import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../interfaces/AuthRequest';
import { PlanService } from '../services/plan.service';
import { UserService } from '../services/user.service';
import { DatabaseError } from '../utils/errors';

export class PlansPageController {
    private planService: PlanService;
    private userService: UserService;

    constructor() {
        this.planService = new PlanService();
        this.userService = new UserService();
    }

    /**
     * Obtiene información de todos los planes disponibles
     * Ruta pública - no requiere autenticación
     */
    public getPlansInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Obtener todos los planes con sus límites y permisos
            const plansQuery = `
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.created_at
                FROM plans p
                ORDER BY p.id ASC
            `;
            
            const plansResult = await this.planService['pool'].query(plansQuery);
            const plans = plansResult.rows;

            // Para cada plan, obtener sus límites y permisos
            const plansWithDetails = await Promise.all(
                plans.map(async (plan) => {
                    const limits = await this.planService.getLimitsForPlan(plan.id);
                    const permissions = await this.planService.getAllPermissionsForPlan(plan.id);
                    
                    return {
                        ...plan,
                        limits,
                        permissions,
                        features: this.getPlanFeatures(plan.name, limits, permissions)
                    };
                })
            );

            res.json({
                success: true,
                plans: plansWithDetails
            });
        } catch (error) {
            console.error('Error al obtener información de planes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener información de planes'
            });
        }
    };

    /**
     * Verifica el estado de autenticación del usuario y redirige según corresponda
     * Ruta pública - verifica token opcional
     */
    public checkAuthStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader) {
                // Usuario no autenticado
                res.json({
                    success: true,
                    authenticated: false,
                    action: 'register',
                    message: 'Usuario no autenticado. Debe crear una cuenta.'
                });
                return;
            }

            const token = authHeader.split(' ')[1];
            if (!token) {
                res.json({
                    success: true,
                    authenticated: false,
                    action: 'register',
                    message: 'Token inválido. Debe crear una cuenta.'
                });
                return;
            }

            // Verificar token (usar el mismo middleware de autenticación)
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || '2004');
                
                // Obtener información del usuario
                const user = await this.userService.getUserById(decoded.id);
                if (!user) {
                    res.json({
                        success: true,
                        authenticated: false,
                        action: 'register',
                        message: 'Usuario no encontrado. Debe crear una cuenta.'
                    });
                    return;
                }

                // Usuario autenticado - verificar si necesita cambiar de plan
                const currentPlan = await this.getPlanById(user.plan_id);
                
                res.json({
                    success: true,
                    authenticated: true,
                    action: 'payment',
                    user: {
                        id: user.id,
                        email: user.email,
                        currentPlan: currentPlan?.name || 'basic',
                        currentPlanId: user.plan_id
                    },
                    message: 'Usuario autenticado. Redirigir a pagos.'
                });

            } catch (jwtError) {
                res.json({
                    success: true,
                    authenticated: false,
                    action: 'register',
                    message: 'Token expirado o inválido. Debe crear una cuenta.'
                });
            }

        } catch (error) {
            console.error('Error al verificar estado de autenticación:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar estado de autenticación'
            });
        }
    };

    /**
     * Endpoint para iniciar el proceso de pago
     * Requiere autenticación
     */
    public initiatePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as AuthRequest).user;
            if (!user) {
                res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
                return;
            }

            const { planId } = req.body;
            if (!planId) {
                res.status(400).json({
                    success: false,
                    message: 'ID del plan es requerido'
                });
                return;
            }

            // Verificar que el plan existe
            const plan = await this.getPlanById(planId);
            if (!plan) {
                res.status(404).json({
                    success: false,
                    message: 'Plan no encontrado'
                });
                return;
            }

            // Verificar que no está intentando cambiar al mismo plan
            if (user.planId === planId) {
                res.status(400).json({
                    success: false,
                    message: 'Ya tienes este plan activo'
                });
                return;
            }

            // TODO: Integrar con sistema de pagos
            // Por ahora, simulamos la creación de una sesión de pago
            const paymentSession = {
                id: `session_${Date.now()}`,
                userId: user.id,
                planId: planId,
                planName: plan.name,
                amount: this.getPlanPrice(plan.name),
                currency: 'CLP',
                status: 'pending',
                createdAt: new Date().toISOString()
            };

            res.json({
                success: true,
                message: 'Sesión de pago creada',
                paymentSession,
                redirectUrl: `/payment/${paymentSession.id}` // URL para el frontend
            });

        } catch (error) {
            console.error('Error al iniciar pago:', error);
            res.status(500).json({
                success: false,
                message: 'Error al iniciar el proceso de pago'
            });
        }
    };

    /**
     * Endpoint para confirmar pago exitoso
     * Requiere autenticación
     */
    public confirmPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as AuthRequest).user;
            if (!user) {
                res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
                return;
            }

            const { sessionId, planId } = req.body;
            if (!sessionId || !planId) {
                res.status(400).json({
                    success: false,
                    message: 'ID de sesión y plan son requeridos'
                });
                return;
            }

            // TODO: Verificar que el pago fue exitoso con el proveedor de pagos

            // Actualizar el plan del usuario
            await this.updateUserPlan(user.id, planId);

            res.json({
                success: true,
                message: 'Plan actualizado exitosamente',
                newPlanId: planId
            });

        } catch (error) {
            console.error('Error al confirmar pago:', error);
            res.status(500).json({
                success: false,
                message: 'Error al confirmar el pago'
            });
        }
    };

    // Métodos auxiliares privados
    private async getPlanById(planId: number) {
        const query = 'SELECT * FROM plans WHERE id = $1';
        const result = await this.planService['pool'].query(query, [planId]);
        return result.rows[0] || null;
    }

    private getPlanFeatures(planName: string, limits: any, permissions: string[]) {
        const features = {
            basic: [
                'Máximo 2 tarjetas',
                '100 movimientos manuales por mes',
                '5 palabras clave por categoría',
                '5 movimientos proyectados',
                'Categorización básica',
                'Soporte por email',
                'Sin cartolas bancarias',
                'Sin scraper automático'
            ],
            premium: [
                'Máximo 10 tarjetas',
                '1,000 movimientos manuales por mes',
                'Cartolas bancarias ILIMITADAS',
                '10 palabras clave por categoría',
                '20 movimientos proyectados',
                'Categorización avanzada',
                'Exportar datos',
                'Soporte prioritario',
                'Sin scraper automático'
            ],
            pro: [
                'TODO ILIMITADO',
                'Tarjetas ilimitadas',
                'Movimientos manuales ilimitados',
                'Cartolas bancarias ilimitadas',
                'Movimientos proyectados ilimitados',
                'Palabras clave ilimitadas por categoría',
                'Scraper automático de bancos',
                'Categorización automatizada con IA',
                'Exportar datos',
                'Soporte prioritario'
            ]
        };

        return features[planName as keyof typeof features] || [];
    }

    private getPlanPrice(planName: string): number {
        const prices = {
            basic: 0,        // Gratis
            premium: 10000,  // $10.000 CLP
            pro: 25000       // $25.000 CLP
        };

        return prices[planName as keyof typeof prices] || 0;
    }

    private async updateUserPlan(userId: number, planId: number): Promise<void> {
        const query = 'UPDATE "user" SET plan_id = $1, updated_at = NOW() WHERE id = $2';
        await this.planService['pool'].query(query, [planId, userId]);
    }
} 