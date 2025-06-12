"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardController = void 0;
const card_service_1 = require("../services/card.service");
const errors_1 = require("../utils/errors");
const cardSchema_1 = require("../validators/cardSchema");
const zod_1 = require("zod");
class CardController {
    constructor() {
        this.getAllCards = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const cards = await this.cardService.getCardsByUserId(userId);
                res.json(cards);
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    res.status(400).json({ error: error.message });
                }
                else {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
        this.getCardById = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                const card = await this.cardService.getCardById(id, userId);
                res.json(card);
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    res.status(404).json({ error: error.message });
                }
                else {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
        this.getTotalBalanceByUserId = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const total = await this.cardService.getTotalBalanceByUserId(userId);
                res.json({ total });
            }
            catch (e) {
                res.status(500).json({ error: 'Error al obtener el total de saldos' });
            }
        };
        this.createCard = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const validatedData = cardSchema_1.cardSchema.parse(req.body);
                // Prevenir tarjetas duplicadas
                const { nameAccount, cardTypeId, bankId } = validatedData;
                const safeBankId = typeof bankId === 'number' ? bankId : undefined;
                if (await this.cardService.cardExists(userId, nameAccount, cardTypeId, bankId)) {
                    res.status(409).json({
                        error: 'Ya existe una tarjeta con este nombre, banco y tipo para este usuario.'
                    });
                    return;
                }
                const card = await this.cardService.createCard({
                    ...validatedData,
                    userId,
                    bankId: safeBankId // para asegurarte que no va null
                });
                res.status(201).json(card);
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
                    res.status(400).json({
                        error: 'Error de validación',
                        details: error.errors.map(e => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    });
                }
                else if (error instanceof errors_1.DatabaseError) {
                    res.status(400).json({ error: error.message });
                }
                else {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
        this.updateCard = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                const validatedData = cardSchema_1.cardUpdateSchema.parse(req.body);
                const card = await this.cardService.updateCard(id, userId, validatedData); // Solo balance y alias
                res.json(card);
            }
            catch (error) {
                if (error instanceof zod_1.ZodError) {
                    res.status(400).json({
                        error: 'Error de validación',
                        details: error.errors.map(e => ({
                            field: e.path.join('.'),
                            message: e.message
                        }))
                    });
                }
                else if (error instanceof errors_1.DatabaseError) {
                    res.status(400).json({ error: error.message });
                }
                else {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
        this.deleteCard = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                await this.cardService.deleteCard(id, userId);
                res.status(204).send();
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    res.status(400).json({ error: error.message });
                }
                else {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
        this.syncCardsFromUser = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const syncedCards = await this.cardService.getCardsByUserId(userId);
                res.json(syncedCards);
            }
            catch (error) {
                console.error('Error al sincronizar tarjetas del usuario:', error);
                res.status(500).json({ error: 'Error al sincronizar tarjetas del usuario' });
            }
        };
        this.updateBalance = async (req, res) => {
            try {
                const userId = req.user?.id;
                if (!userId) {
                    res.status(401).json({ error: 'Usuario no autenticado' });
                    return;
                }
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                const { amount } = req.body;
                if (typeof amount !== 'number') {
                    res.status(400).json({ error: 'El monto debe ser un número' });
                    return;
                }
                const card = await this.cardService.updateBalance(id, userId, amount);
                res.json(card);
            }
            catch (error) {
                if (error instanceof errors_1.DatabaseError) {
                    res.status(400).json({ error: error.message });
                }
                else {
                    res.status(500).json({ error: 'Error interno del servidor' });
                }
            }
        };
        this.cardService = new card_service_1.CardService();
    }
}
exports.CardController = CardController;
//# sourceMappingURL=CardController.js.map