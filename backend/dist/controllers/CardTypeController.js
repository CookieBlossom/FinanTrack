"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardTypeController = void 0;
const cardType_service_1 = require("../services/cardType.service");
const errors_1 = require("../utils/errors");
const cardTypeSchema_1 = require("../validators/cardTypeSchema");
const zod_1 = require("zod");
class CardTypeController {
    constructor() {
        this.getAllCardTypes = async (req, res, next) => {
            try {
                const types = await this.cardTypeService.getAllCardTypes();
                res.json(types);
            }
            catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        };
        this.getCardTypeById = async (req, res, next) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                const cardType = await this.cardTypeService.getCardTypeById(id);
                res.json(cardType);
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
        this.createCardType = async (req, res, next) => {
            try {
                const validatedData = cardTypeSchema_1.cardTypeSchema.parse(req.body);
                const cardType = await this.cardTypeService.createCardType(validatedData);
                res.status(201).json(cardType);
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
        this.updateCardType = async (req, res, next) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                const validatedData = cardTypeSchema_1.cardTypeUpdateSchema.parse(req.body);
                const cardType = await this.cardTypeService.updateCardType(id, validatedData);
                res.json(cardType);
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
        this.deleteCardType = async (req, res, next) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ error: 'Formato de ID inválido' });
                    return;
                }
                await this.cardTypeService.deleteCardType(id);
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
        this.cardTypeService = new cardType_service_1.CardTypeService();
    }
}
exports.CardTypeController = CardTypeController;
//# sourceMappingURL=CardTypeController.js.map