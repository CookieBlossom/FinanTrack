import { Request, Response, NextFunction } from 'express';
import { MovementService } from '../services/movement.service';
import { IMovementCreate, IMovementUpdate, IMovementFilters } from '../interfaces/IMovement';
import { AuthRequest } from '../interfaces/AuthRequest';
import { DatabaseError } from '../utils/errors';
import multer from 'multer';
import { Pool } from 'pg';
import { pool } from '../config/database/connection';

export class MovementController {
    private movementService: MovementService;
    private pool: Pool;

    constructor() {
        this.movementService = new MovementService();
        this.pool = pool;
    }

    public getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            const movements = await this.movementService.getMovements({ userId });
            res.json(movements);
        } catch (error) {
            console.error('Error al obtener movimientos:', error);
            res.status(500).json({
                message: 'Error al obtener los movimientos',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getCashMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            const cashMovements = await this.movementService.getCashMovementsByUser(userId);
            res.json(cashMovements);
        } catch (error) {
            console.error('Error al obtener movimientos en efectivo:', error);
            res.status(500).json({
                message: 'Error al obtener los movimientos en efectivo',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getCardMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            const cardMovements = await this.movementService.getCardMovementsByUser(userId);
            res.json(cardMovements);
        } catch (error) {
            console.error('Error al obtener movimientos de tarjetas:', error);
            res.status(500).json({
                message: 'Error al obtener los movimientos de tarjetas',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({ message: 'ID de movimiento inválido' });
                return;
            }
            const movement = await this.movementService.getMovementById(id);
            
            if (!movement) {
                res.status(404).json({ message: 'Movimiento no encontrado' });
                return;
            }
            
            res.json(movement);
        } catch (error) {
            console.error('Error al obtener movimiento:', error);
            res.status(500).json({
                message: 'Error al obtener el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getByFilters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            // Determinar si los datos vienen del body (POST) o query params (GET)
            const source = req.method === 'POST' ? req.body : req.query;

            const filters: IMovementFilters = {
                userId,
                cardId: source.cardId ? parseInt(source.cardId as string) : undefined,
                categoryId: source.categoryId ? parseInt(source.categoryId as string) : undefined,
                movementType: source.movementType as 'income' | 'expense' | undefined,
                movementSource: source.movementSource as 'manual' | 'scraper' | 'subscription' | 'projected' | undefined,
                startDate: source.startDate ? new Date(source.startDate as string) : undefined,
                endDate: source.endDate ? new Date(source.endDate as string) : undefined,
                minAmount: source.minAmount ? parseFloat(source.minAmount as string) : undefined,
                maxAmount: source.maxAmount ? parseFloat(source.maxAmount as string) : undefined,
                limit: source.limit ? parseInt(source.limit as string) : undefined,
                offset: source.offset ? parseInt(source.offset as string) : undefined,
                orderBy: source.orderBy as string | undefined,
                orderDirection: source.orderDirection as 'ASC' | 'DESC' | undefined
            };

            const movements = await this.movementService.getMovements(filters);
            res.json(movements);
        } catch (error) {
            console.error('Error al filtrar movimientos:', error);
            res.status(500).json({
                message: 'Error al filtrar los movimientos',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as AuthRequest).user;
            if (!user) {
                res.status(401).json({ message: 'Usuario no autenticado para crear movimiento' });
                return;
            }

            console.log(`[MovementController] Datos recibidos del frontend:`, req.body);
            console.log(`[MovementController] Monto recibido: ${req.body.amount} (tipo: ${typeof req.body.amount})`);

            const movementData: IMovementCreate = {
                ...req.body,
                amount: Number(req.body.amount), // Asegurar que sea número
                transactionDate: new Date(req.body.transactionDate)
            };
            
            console.log(`[MovementController] Monto después de conversión: ${movementData.amount} (tipo: ${typeof movementData.amount})`);
            // Si es un movimiento de efectivo (useCashCard = true), asignar automáticamente la tarjeta de efectivo
            if (req.body.useCashCard) {
                try {
                    const efectivoCardQuery = `
                        SELECT c.id 
                        FROM cards c 
                        JOIN card_types ct ON c.card_type_id = ct.id 
                        WHERE c.user_id = $1 AND c.status_account = 'active' 
                        AND ct.name = 'Efectivo' 
                        LIMIT 1
                    `;
                    const efectivoCardResult = await this.pool.query(efectivoCardQuery, [user.id]);
                    const efectivoCardId = efectivoCardResult.rows[0]?.id;
                    
                    if (!efectivoCardId) {
                        res.status(400).json({ message: 'No se encontró una tarjeta de efectivo configurada' });
                        return;
                    }
                    
                    movementData.cardId = efectivoCardId;
                } catch (error) {
                    console.error('Error al obtener tarjeta de efectivo:', error);
                    res.status(500).json({ message: 'Error al procesar movimiento de efectivo' });
                    return;
                }
            }
            
            if (!this.validateMovementData(movementData)) {
                res.status(400).json({ message: 'Datos del movimiento incompletos o inválidos' });
                return;
            }

            const newMovement = await this.movementService.createMovement(movementData, user.id, user.planId);
            res.status(201).json(newMovement);
        } catch (error) {
            console.error('Error al crear movimiento:', error);
            res.status(500).json({
                message: 'Error al crear el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado para actualizar movimiento' });
                return;
            }

            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({ message: 'ID de movimiento inválido' });
                return;
            }
            const movementData: IMovementUpdate = {
                ...req.body,
                transactionDate: req.body.transactionDate ? new Date(req.body.transactionDate) : undefined
            };

            if (!Object.keys(movementData).length) {
                res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
                return;
            }

            const updatedMovement = await this.movementService.updateMovement(id, movementData, userId);
            
            if (!updatedMovement) {
                res.status(404).json({ message: 'Movimiento no encontrado' });
                return;
            }

            res.json(updatedMovement);
        } catch (error) {
            console.error('Error al actualizar movimiento:', error);
            res.status(500).json({
                message: 'Error al actualizar el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado para eliminar movimiento' });
                return;
            }

            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                res.status(400).json({ message: 'ID de movimiento inválido' });
                return;
            }
            await this.movementService.deleteMovement(id, userId);

            res.status(200).json({ message: 'Movimiento eliminado correctamente' });
        } catch (error: any) {
            console.error('Error al eliminar movimiento:', error);
            if (error instanceof DatabaseError) {
                 res.status(error.message.toLowerCase().includes("no encontrado") ? 404 :
                             error.message.toLowerCase().includes("no pertenece") ? 403 : 500)
                    .json({ message: error.message });
            } else if (error instanceof Error) {
                res.status(500).json({
                    message: 'Error al eliminar el movimiento',
                    error: error.message
                });
            } else {
                res.status(500).json({
                    message: 'Error desconocido al eliminar el movimiento'
                });
            }
        }
    };

    public uploadCartola = async (req: Request & { file?: any }, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = (req as AuthRequest).user;
            if (!user) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            if (!req.file) {
                res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
                return;
            }

            await this.movementService.processCartolaMovements(req.file.buffer, user.id, user.planId);
            res.status(200).json({ message: 'Cartola procesada correctamente' });
        } catch (error) {
            console.error('Error al procesar cartola:', error);
            res.status(500).json({
                message: 'Error al procesar la cartola',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    public getMonthlySummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = (req as AuthRequest).user?.id;
            const { month } = req.query;
            if (!userId || !month || typeof month !== 'string') {
                res.status(400).json({ message: 'Faltan parámetros' });
                return;
            }
            const summary = await this.movementService.getMonthlySummary(userId, month);
            res.json(summary);
        } catch (error) {
            console.error('Error al obtener resumen mensual:', error);
            res.status(500).json({ message: 'Error al obtener el resumen mensual' });
        }
    };

    private validateMovementData(data: IMovementCreate): boolean {
        return !!(
            data.cardId &&
            data.amount &&
            data.movementType &&
            data.transactionDate
        );
    }
} 
