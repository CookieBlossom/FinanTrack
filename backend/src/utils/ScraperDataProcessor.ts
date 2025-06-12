import { IScraperMovement } from '../interfaces/IScraper';
import { IMovementCreate } from '../interfaces/IMovement';

export class ScraperDataProcessor {
    /**
     * Procesa un movimiento del scraper y lo convierte al formato de la base de datos
     */
    static async processMovement(movement: IScraperMovement, defaultCardId: number): Promise<IMovementCreate> {
        const amount = Math.abs(movement.monto);
        const movementType = movement.monto >= 0 ? 'income' : 'expense';

        return {
            description: movement.descripcion,
            amount: amount,
            transactionDate: new Date(movement.fecha),
            cardId: defaultCardId,
            movementType: movementType,
            categoryId: movement.categoria && !isNaN(Number(movement.categoria))
            ? Number(movement.categoria)
            : 8, // "Otros"
            movementSource: 'scraper',
            metadata: {
                tipo: movement.tipo,
                cuenta: movement.cuenta,
                referencia: movement.referencia,
                estado: movement.estado
            }
        };
    }

    /**
     * Procesa un array de movimientos del scraper
     */
    static async processMovements(movements: IScraperMovement[], defaultCardId: number): Promise<IMovementCreate[]> {
        return Promise.all(movements.map(mov => this.processMovement(mov, defaultCardId)));
    }
} 