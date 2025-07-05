"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementController = void 0;
const movement_service_1 = require("../services/movement.service");
const errors_1 = require("../utils/errors");
const connection_1 = require("../config/database/connection");
class MovementController {
    constructor() {
        this.getAll = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const movements = await this.movementService.getMovements({ userId });
                res.json(movements);
            }
            catch (error) {
                console.error('Error al obtener movimientos:', error);
                res.status(500).json({
                    message: 'Error al obtener los movimientos',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.getCashMovements = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const cashMovements = await this.movementService.getCashMovementsByUser(userId);
                res.json(cashMovements);
            }
            catch (error) {
                console.error('Error al obtener movimientos en efectivo:', error);
                res.status(500).json({
                    message: 'Error al obtener los movimientos en efectivo',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.getCardMovements = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                const cardMovements = await this.movementService.getCardMovementsByUser(userId);
                res.json(cardMovements);
            }
            catch (error) {
                console.error('Error al obtener movimientos de tarjetas:', error);
                res.status(500).json({
                    message: 'Error al obtener los movimientos de tarjetas',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.getById = async (req, res, next) => {
            try {
                const userId = req.user?.id;
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
            }
            catch (error) {
                console.error('Error al obtener movimiento:', error);
                res.status(500).json({
                    message: 'Error al obtener el movimiento',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.getByFilters = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado' });
                    return;
                }
                // Determinar si los datos vienen del body (POST) o query params (GET)
                const source = req.method === 'POST' ? req.body : req.query;
                const filters = {
                    userId,
                    cardId: source.cardId ? parseInt(source.cardId) : undefined,
                    categoryId: source.categoryId ? parseInt(source.categoryId) : undefined,
                    movementType: source.movementType,
                    movementSource: source.movementSource,
                    startDate: source.startDate ? new Date(source.startDate) : undefined,
                    endDate: source.endDate ? new Date(source.endDate) : undefined,
                    minAmount: source.minAmount ? parseFloat(source.minAmount) : undefined,
                    maxAmount: source.maxAmount ? parseFloat(source.maxAmount) : undefined,
                    limit: source.limit ? parseInt(source.limit) : undefined,
                    offset: source.offset ? parseInt(source.offset) : undefined,
                    orderBy: source.orderBy,
                    orderDirection: source.orderDirection
                };
                const movements = await this.movementService.getMovements(filters);
                res.json(movements);
            }
            catch (error) {
                console.error('Error al filtrar movimientos:', error);
                res.status(500).json({
                    message: 'Error al filtrar los movimientos',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.create = async (req, res, next) => {
            try {
                const user = req.user;
                if (!user) {
                    res.status(401).json({ message: 'Usuario no autenticado para crear movimiento' });
                    return;
                }
                console.log(`[MovementController] Datos recibidos del frontend:`, req.body);
                console.log(`[MovementController] Monto recibido: ${req.body.amount} (tipo: ${typeof req.body.amount})`);
                const movementData = {
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
                    }
                    catch (error) {
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
            }
            catch (error) {
                console.error('Error al crear movimiento:', error);
                res.status(500).json({
                    message: 'Error al crear el movimiento',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.update = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ message: 'Usuario no autenticado para actualizar movimiento' });
                    return;
                }
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ message: 'ID de movimiento inválido' });
                    return;
                }
                const movementData = {
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
            }
            catch (error) {
                console.error('Error al actualizar movimiento:', error);
                res.status(500).json({
                    message: 'Error al actualizar el movimiento',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.delete = async (req, res, next) => {
            try {
                const userId = req.user?.id;
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
            }
            catch (error) {
                console.error('Error al eliminar movimiento:', error);
                if (error instanceof errors_1.DatabaseError) {
                    res.status(error.message.toLowerCase().includes("no encontrado") ? 404 :
                        error.message.toLowerCase().includes("no pertenece") ? 403 : 500)
                        .json({ message: error.message });
                }
                else if (error instanceof Error) {
                    res.status(500).json({
                        message: 'Error al eliminar el movimiento',
                        error: error.message
                    });
                }
                else {
                    res.status(500).json({
                        message: 'Error desconocido al eliminar el movimiento'
                    });
                }
            }
        };
        this.uploadCartola = async (req, res, next) => {
            try {
                const user = req.user;
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
            }
            catch (error) {
                console.error('Error al procesar cartola:', error);
                res.status(500).json({
                    message: 'Error al procesar la cartola',
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        };
        this.getMonthlySummary = async (req, res, next) => {
            try {
                const userId = req.user?.id;
                const { month } = req.query;
                if (!userId || !month || typeof month !== 'string') {
                    res.status(400).json({ message: 'Faltan parámetros' });
                    return;
                }
                const summary = await this.movementService.getMonthlySummary(userId, month);
                res.json(summary);
            }
            catch (error) {
                console.error('Error al obtener resumen mensual:', error);
                res.status(500).json({ message: 'Error al obtener el resumen mensual' });
            }
        };
        this.movementService = new movement_service_1.MovementService();
        this.pool = connection_1.pool;
    }
    validateMovementData(data) {
        return !!(data.cardId &&
            data.amount &&
            data.movementType &&
            data.transactionDate);
    }
}
exports.MovementController = MovementController;
//# sourceMappingURL=MovementController.js.map