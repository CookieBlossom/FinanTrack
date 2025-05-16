import { Response } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { ISubscriptionCreate, ISubscriptionUpdate, ISubscriptionFilters } from '../interfaces/ISubscription';
import { IAuthRequest } from '../interfaces/IRequest';

export class SubscriptionController {
    private subscriptionService: SubscriptionService;

    constructor() {
        this.subscriptionService = new SubscriptionService();
    }

    getAll = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const subscriptions = await this.subscriptionService.getAllSubscriptions(userId);
            res.json(subscriptions);
        } catch (error) {
            console.error('Error al obtener suscripciones:', error);
            res.status(500).json({
                message: 'Error al obtener las suscripciones',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    getById = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const subscription = await this.subscriptionService.getSubscriptionById(id, userId);
            
            if (!subscription) {
                res.status(404).json({ message: 'Suscripción no encontrada' });
                return;
            }
            
            res.json(subscription);
        } catch (error) {
            console.error('Error al obtener suscripción:', error);
            res.status(500).json({
                message: 'Error al obtener la suscripción',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    getByFilters = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const filters: ISubscriptionFilters = {
                userId,
                categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
                paymentMethodId: req.query.paymentMethodId ? parseInt(req.query.paymentMethodId as string) : undefined,
                billingPeriod: req.query.billingPeriod as 'monthly' | 'yearly' | 'weekly' | undefined,
                status: req.query.status as 'active' | 'paused' | 'cancelled' | undefined,
                minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
                maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
            };

            const subscriptions = await this.subscriptionService.getSubscriptionsByFilters(filters);
            res.json(subscriptions);
        } catch (error) {
            console.error('Error al filtrar suscripciones:', error);
            res.status(500).json({
                message: 'Error al filtrar las suscripciones',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    create = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const subscriptionData: ISubscriptionCreate = {
                ...req.body,
                userId,
                nextBillingDate: new Date(req.body.nextBillingDate)
            };
            
            if (!this.validateSubscriptionData(subscriptionData)) {
                res.status(400).json({ message: 'Datos de la suscripción incompletos o inválidos' });
                return;
            }

            const newSubscription = await this.subscriptionService.createSubscription(subscriptionData);
            res.status(201).json(newSubscription);
        } catch (error) {
            console.error('Error al crear suscripción:', error);
            res.status(500).json({
                message: 'Error al crear la suscripción',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    update = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const subscriptionData: ISubscriptionUpdate = {
                ...req.body,
                nextBillingDate: req.body.nextBillingDate ? new Date(req.body.nextBillingDate) : undefined
            };

            if (!Object.keys(subscriptionData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            const updatedSubscription = await this.subscriptionService.updateSubscription(
                id,
                userId,
                subscriptionData
            );
            
            if (!updatedSubscription) {
                res.status(404).json({ message: 'Suscripción no encontrada' });
                return;
            }

            res.json(updatedSubscription);
        } catch (error) {
            console.error('Error al actualizar suscripción:', error);
            res.status(500).json({
                message: 'Error al actualizar la suscripción',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    delete = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const deleted = await this.subscriptionService.deleteSubscription(id, userId);

            if (!deleted) {
                res.status(404).json({ message: 'Suscripción no encontrada' });
                return;
            }

            res.status(200).json({ message: 'Suscripción eliminada correctamente' });
        } catch (error) {
            console.error('Error al eliminar suscripción:', error);
            res.status(500).json({
                message: 'Error al eliminar la suscripción',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    updateNextBillingDate = async (req: IAuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const id = parseInt(req.params.id);
            const updatedSubscription = await this.subscriptionService.updateNextBillingDate(id, userId);

            if (!updatedSubscription) {
                res.status(404).json({ message: 'Suscripción no encontrada' });
                return;
            }

            res.json(updatedSubscription);
        } catch (error) {
            console.error('Error al actualizar fecha de próximo cobro:', error);
            res.status(500).json({
                message: 'Error al actualizar la fecha de próximo cobro',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    private validateSubscriptionData(data: ISubscriptionCreate): boolean {
        return !!(
            data.userId &&
            data.name &&
            data.amount &&
            data.billingPeriod &&
            data.nextBillingDate
        );
    }
} 