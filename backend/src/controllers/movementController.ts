import { Request, Response } from 'express';
import { MovementService } from '../services/movement.service';
import { IMovementCreate, IMovementUpdate, IMovementFilters } from '../interfaces/IMovement';
import { AuthRequest } from '../interfaces/AuthRequest';
import { DatabaseError } from '../utils/errors';
import multer from 'multer';
export class MovementController {
    private movementService: MovementService;

    constructor() {
        this.movementService = new MovementService();
    }

    getAll = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
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

    getById = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }
            const id = parseInt(req.params.id);
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

    getByFilters = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            const filters: IMovementFilters = {
                userId,
                cardId: req.query.cardId ? parseInt(req.query.cardId as string) : undefined,
                categoryId: req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined,
                movementType: req.query.movementType as 'income' | 'expense' | undefined,
                movementSource: req.query.movementSource as 'manual' | 'scraper' | 'subscription' | 'projected' | undefined,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
                minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
                maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
                orderBy: req.query.orderBy as string | undefined,
                orderDirection: req.query.orderDirection as 'ASC' | 'DESC' | undefined
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

    create = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado para crear movimiento' });
                return;
            }

            const movementData: IMovementCreate = {
                ...req.body,
                transactionDate: new Date(req.body.transactionDate)
            };
            
            if (!this.validateMovementData(movementData)) {
                res.status(400).json({ message: 'Datos del movimiento incompletos o inválidos' });
                return;
            }

            const newMovement = await this.movementService.createMovement(movementData, userId);
            res.status(201).json(newMovement);
        } catch (error) {
            console.error('Error al crear movimiento:', error);
            res.status(500).json({
                message: 'Error al crear el movimiento',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    update = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado para actualizar movimiento' });
                return;
            }

            const id = parseInt(req.params.id);
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

    delete = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado para eliminar movimiento' });
                return;
            }

            const id = parseInt(req.params.id);
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

    uploadCartola = async (req: AuthRequest & { file?: any }, res: Response): Promise<void> => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ message: 'Usuario no autenticado' });
                return;
            }

            if (!req.file) {
                res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
                return;
            }

            if (req.file.mimetype !== 'application/pdf') {
                res.status(400).json({ error: 'El archivo debe ser un PDF' });
                return;
            }

            await this.movementService.processCartolaMovements(req.file.buffer, userId);
            res.json({ message: 'Cartola procesada exitosamente' });
        } catch (error) {
            console.error('Error al procesar cartola:', error);
            res.status(500).json({
                message: 'Error al procesar la cartola',
                error: error instanceof Error ? error.message : 'Error desconocido'
            });
        }
    };

    private validateMovementData(data: IMovementCreate): boolean {
        return !!(
            data.cardId &&
            data.amount &&
            data.movementType &&
            data.movementSource &&
            data.transactionDate
        );
    }
} 