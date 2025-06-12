"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryService = void 0;
const connection_1 = require("../config/database/connection");
class CategoryService {
    constructor() {
        this.pool = connection_1.pool;
    }
    // Todas las categorías (sin keywords)
    async getAllCategories() {
        const query = 'SELECT * FROM categories ORDER BY name_category ASC';
        const result = await this.pool.query(query);
        return result.rows;
    }
    // Categorías con keywords del usuario
    async getUserCategories(userId) {
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
    async updateUserCategoryKeywords(userId, categoryId, keywords) {
        const query = `
      INSERT INTO user_category_keywords (user_id, category_id, keywords, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, category_id)
      DO UPDATE SET keywords = $3, updated_at = NOW()
    `;
        await this.pool.query(query, [userId, categoryId, keywords]);
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