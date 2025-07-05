import { IScraperMovement } from '../interfaces/IScraper';
import { IMovementCreate } from '../interfaces/IMovement';
import { CompanyService } from '../services/company.service';

export class ScraperDataProcessor {
    private static companyService = new CompanyService();
    
    /**
     * Procesa un movimiento del scraper y lo convierte al formato de la base de datos
     */
    static async processMovement(movement: IScraperMovement, defaultCardId: number): Promise<IMovementCreate> {
        const amount = Math.abs(movement.monto);
        const movementType = movement.monto >= 0 ? 'income' : 'expense';
        
        // Categorización automática usando CompanyService
        let categoryId: number = 8; // "Otros" por defecto
        
        if (movement.descripcion) {
            const automaticCategoryId: number | null = await this.companyService.findCategoryForDescription(movement.descripcion);
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
    static async processMovements(movements: IScraperMovement[], defaultCardId: number): Promise<IMovementCreate[]> {
        return Promise.all(movements.map(mov => this.processMovement(mov, defaultCardId)));
    }
} 