"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperDataProcessor = void 0;
const company_service_1 = require("../services/company.service");
class ScraperDataProcessor {
    /**
     * Procesa un movimiento del scraper y lo convierte al formato de la base de datos
     */
    static async processMovement(movement, defaultCardId) {
        const amount = Math.abs(movement.monto);
        const movementType = movement.monto >= 0 ? 'income' : 'expense';
        // Categorización automática usando CompanyService
        let categoryId = 8; // "Otros" por defecto
        if (movement.descripcion) {
            const automaticCategoryId = await this.companyService.findCategoryForDescription(movement.descripcion);
            if (automaticCategoryId !== null) {
                categoryId = automaticCategoryId;
            }
        }
        return {
            description: movement.descripcion,
            amount: amount,
            transactionDate: new Date(movement.fecha),
            cardId: defaultCardId,
            movementType: movementType,
            categoryId: categoryId,
            movementSource: 'scraper',
            metadata: {
                tipo: movement.tipo,
                cuenta: movement.cuenta,
                referencia: movement.referencia,
                estado: movement.estado,
                categoria_automatica: movement.categoria_automatica || null
            }
        };
    }
    /**
     * Procesa un array de movimientos del scraper
     */
    static async processMovements(movements, defaultCardId) {
        return Promise.all(movements.map(mov => this.processMovement(mov, defaultCardId)));
    }
}
exports.ScraperDataProcessor = ScraperDataProcessor;
ScraperDataProcessor.companyService = new company_service_1.CompanyService();
//# sourceMappingURL=ScraperDataProcessor.js.map