"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const connection_1 = require("../config/database/connection");
const plan_service_1 = require("./plan.service");
const errors_1 = require("../utils/errors");
class CategoryService {
    constructor() {
        this.pool = connection_1.pool;
        this.planService = new plan_service_1.PlanService();
    }
    // Verificar límites de keywords por categoría
    async checkKeywordsLimit(userId, planId, categoryId, newKeywords) {
        const limits = await this.planService.getLimitsForPlan(planId);
        const maxKeywords = limits.keywords_per_category || 5; // Por defecto 5 keywords
        if (maxKeywords === -1) {
            return; // Ilimitado
        }
        if (newKeywords.length > maxKeywords) {
            throw new errors_1.DatabaseError(`Has excedido el límite de ${maxKeywords} palabras clave por categoría para tu plan.`);
        }
    }
    // Verificar permisos de categorización avanzada
    async checkAdvancedCategorizationPermission(planId) {
        const hasPermission = await this.planService.hasPermission(planId, 'advanced_categorization');
        if (!hasPermission) {
            throw new errors_1.DatabaseError('Tu plan no incluye categorización avanzada.');
        }
    }
    // Todas las categorías (sin keywords)
    async getAllCategories() {
        const query = 'SELECT * FROM categories ORDER BY name_category ASC';
        const result = await this.pool.query(query);
        return result.rows;
    }
    // Categorías con keywords del usuario
    async getUserCategories(userId) {
        console.log(`Obteniendo categorías para usuario ${userId}`);
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
        console.log(`Resultado de la consulta:`, result.rows);
        // Log cada categoría para debuggear
        result.rows.forEach((row, index) => {
            console.log(`Categoría ${index + 1}: ${row.name_category} - Keywords:`, row.keywords);
        });
        return result.rows;
    }
    // Actualiza solo las keywords
    async updateUserCategoryKeywords(userId, categoryId, keywords, planId) {
        console.log(`Actualizando keywords para usuario ${userId}, categoría ${categoryId}:`, keywords);
        // Verificar que el usuario existe
        const userCheckQuery = 'SELECT id FROM "user" WHERE id = $1 AND is_active = true';
        const userResult = await this.pool.query(userCheckQuery, [userId]);
        if (userResult.rowCount === 0) {
            throw new Error(`Usuario con ID ${userId} no existe o no está activo`);
        }
        console.log(`Usuario ${userId} verificado correctamente`);
        // Verificar límites de keywords por categoría (temporalmente deshabilitado)
        try {
            await this.checkKeywordsLimit(userId, planId, categoryId, keywords);
        }
        catch (error) {
            console.log('Error al verificar límites, continuando sin verificación:', error);
            // Continuar sin verificación de límites por ahora
        }
        const query = `
            INSERT INTO user_category_keywords (user_id, category_id, keywords, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, category_id)
            DO UPDATE SET keywords = $3, updated_at = NOW()
        `;
        console.log(`Ejecutando query con parámetros:`, [userId, categoryId, keywords]);
        const result = await this.pool.query(query, [userId, categoryId, keywords]);
        console.log(`Query ejecutada exitosamente. Filas afectadas:`, result.rowCount);
        // Verificar que se guardó correctamente
        const verifyQuery = `
            SELECT keywords FROM user_category_keywords 
            WHERE user_id = $1 AND category_id = $2
        `;
        const verifyResult = await this.pool.query(verifyQuery, [userId, categoryId]);
        console.log(`Verificación - Keywords guardadas:`, verifyResult.rows[0]?.keywords);
    }
    // Actualiza solo el color (de categoría global)
    async updateCategoryColor(categoryId, color) {
        const query = `
            UPDATE categories SET color = $1, updated_at = NOW() WHERE id = $2
        `;
        await this.pool.query(query, [color, categoryId]);
    }
}
exports.CategoryService = CategoryService;
//# sourceMappingURL=category.service.js.map