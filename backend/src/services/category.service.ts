import { Pool } from 'pg';
import { ICategory } from '../interfaces/ICategory';
import { pool } from '../config/database/connection';
import { PlanService } from './plan.service';
import { DatabaseError } from '../utils/errors';

interface Company {
    normalizedName: string;
    keywords: string[];
    category: string;
}

export class CategoryService {
    private pool: Pool;
    private planService: PlanService;
    
    constructor() {
      this.pool = pool;
      this.planService = new PlanService();
    }

    // Verificar límites de keywords por categoría
    private async checkKeywordsLimit(userId: number, planId: number, categoryId: number, newKeywords: string[]): Promise<void> {
        const limits = await this.planService.getLimitsForPlan(planId);
        const maxKeywords = limits.keywords_per_category || 5; // Por defecto 5 keywords

        if (maxKeywords === -1) {
            return; // Ilimitado
        }

        if (newKeywords.length > maxKeywords) {
            throw new DatabaseError(`Has excedido el límite de ${maxKeywords} palabras clave por categoría para tu plan.`);
        }
    }

    // Verificar permisos de categorización avanzada
    private async checkAdvancedCategorizationPermission(planId: number): Promise<void> {
        const hasPermission = await this.planService.hasPermission(planId, 'advanced_categorization');
        if (!hasPermission) {
            throw new DatabaseError('Tu plan no incluye categorización avanzada.');
        }
    }

    // Todas las categorías (sin keywords)
    async getAllCategories(): Promise<ICategory[]> {
        const query = 'SELECT * FROM categories ORDER BY name_category ASC';
        const result = await this.pool.query(query);
        return result.rows;
    }

    // Categorías con keywords del usuario
    async getUserCategories(userId: number): Promise<ICategory[]> {
        const query = `
            SELECT 
                c.*, 
                COALESCE(uck.keywords, ARRAY[]::text[]) AS keywords
            FROM categories c
            LEFT JOIN user_category_keywords uck
                ON uck.category_id = c.id AND uck.user_id = $1
            ORDER BY c.name_category ASC
        `;
        const result = await this.pool.query(query, [userId]);
        return result.rows;
    }

    // Actualiza solo las keywords
    async updateUserCategoryKeywords(userId: number, categoryId: number, keywords: string[], planId: number): Promise<void> {
        // Verificar límites de keywords por categoría
        await this.checkKeywordsLimit(userId, planId, categoryId, keywords);

        const query = `
            INSERT INTO user_category_keywords (user_id, category_id, keywords, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, category_id)
            DO UPDATE SET keywords = $3, updated_at = NOW()
        `;
        await this.pool.query(query, [userId, categoryId, keywords]);
    }

    // Actualiza solo el color (de categoría global)
    async updateCategoryColor(categoryId: number, color: string): Promise<void> {
        const query = `
            UPDATE categories SET color = $1, updated_at = NOW() WHERE id = $2
        `;
        await this.pool.query(query, [color, categoryId]);
    }
} 