import { Pool } from 'pg';
import { ICategory, ICategoryCreate, ICategoryUpdate } from '../interfaces/ICategory';
import { pool } from '../config/database/connection';

export class CategoryService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    async getAllCategories(): Promise<ICategory[]> {
        const query = 'SELECT id, name_category as "nameCategory", keywords, created_at as "createdAt", updated_at as "updatedAt" FROM categories ORDER BY name_category';
        const result = await this.pool.query(query);
        return result.rows;
    }

    async getCategoryById(id: number): Promise<ICategory | null> {
        const query = 'SELECT id, name_category as "nameCategory", keywords, created_at as "createdAt", updated_at as "updatedAt" FROM categories WHERE id = $1';
        const result = await this.pool.query(query, [id]);
        return result.rows[0] || null;
    }

    async searchCategories(keyword: string): Promise<ICategory[]> {
        const query = `
            SELECT id, name_category as "nameCategory", keywords, created_at as "createdAt", updated_at as "updatedAt" 
            FROM categories 
            WHERE name_category ILIKE $1 
            OR $1 = ANY(keywords)
            ORDER BY name_category
        `;
        const searchPattern = `%${keyword}%`;
        const result = await this.pool.query(query, [searchPattern]);
        return result.rows;
    }

    async createCategory(categoryData: ICategoryCreate): Promise<ICategory> {
        const query = `
            INSERT INTO categories (name_category, keywords)
            VALUES ($1, $2)
            RETURNING id, name_category as "nameCategory", keywords, created_at as "createdAt", updated_at as "updatedAt"
        `;
        const result = await this.pool.query(query, [
            categoryData.nameCategory,
            categoryData.keywords || []
        ]);
        return result.rows[0];
    }

    async updateCategory(id: number, categoryData: ICategoryUpdate): Promise<ICategory | null> {
        const currentCategory = await this.getCategoryById(id);
        if (!currentCategory) return null;

        const query = `
            UPDATE categories
            SET name_category = $1,
                keywords = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING id, name_category as "nameCategory", keywords, created_at as "createdAt", updated_at as "updatedAt"
        `;
        const result = await this.pool.query(query, [
            categoryData.nameCategory || currentCategory.nameCategory,
            categoryData.keywords || currentCategory.keywords || [],
            id
        ]);
        return result.rows[0];
    }

    async deleteCategory(id: number): Promise<boolean> {
        const query = 'DELETE FROM categories WHERE id = $1 RETURNING id';
        const result = await this.pool.query(query, [id]);
        return result.rowCount !== null && result.rowCount > 0;
    }
} 