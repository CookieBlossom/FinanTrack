import { Pool } from 'pg';
import { pool } from '../config/database/connection';
import fs from 'fs';
import path from 'path';

interface Company {
    normalizedName: string;
    keywords: string[];
    category: string;
}

export class CompanyService {
    private pool: Pool;
    private companies: Company[] = [];

    constructor() {
        this.pool = pool;
        this.loadCompanies();
    }

    private loadCompanies() {
        try {
            const companiesPath = path.join(__dirname, '../config/companies.json');
            const companiesData = fs.readFileSync(companiesPath, 'utf8');
            this.companies = JSON.parse(companiesData);
        } catch (error) {
            console.error('Error loading companies:', error);
            this.companies = [];
        }
    }

    private cleanDescription(description: string): string {
        // Lista de prefijos genéricos a ignorar
        const prefijosAIgnorar = [
            'TEF',
            'COMPRA WEB',
            'COMPRA NACIONAL',
            'TRANSFERENCIA',
            'PAGO',
            'FACTU CL',
            'FACTURACION',
            'CARGO',
            'ABONO'
        ];

        let desc = description.toUpperCase().trim();
        
        // Eliminar prefijos genéricos
        for (const prefijo of prefijosAIgnorar) {
            if (desc.startsWith(prefijo)) {
                desc = desc.substring(prefijo.length).trim();
            }
        }

        return desc;
    }

    public getCompaniesData(): Company[] {
        return this.companies;
    }

    public async findCategoryForDescription(description: string): Promise<number | null> {
        try {
            // Limpiar y normalizar la descripción
            const cleanedDesc = this.cleanDescription(description);
            const normalizedDesc = cleanedDesc.toUpperCase().trim();
            
            // También crear una versión sin espacios para mayor flexibilidad
            const noSpacesDesc = normalizedDesc.replace(/\s+/g, '');

            // Buscar coincidencia en las palabras clave de las compañías
            for (const company of this.companies) {
                for (const keyword of company.keywords) {
                    const keywordNoSpaces = keyword.replace(/\s+/g, '');
                    if (normalizedDesc.includes(keyword) || noSpacesDesc.includes(keywordNoSpaces)) {
                        // Obtener el ID de la categoría basado en el nombre
                        const categoryQuery = 'SELECT id FROM categories WHERE LOWER(name_category) = LOWER($1)';
                        const result = await this.pool.query(categoryQuery, [company.category]);
                        
                        if (result.rows.length > 0) {
                            return result.rows[0].id;
                        }
                        break;
                    }
                }
            }

            // Si no hay coincidencia, buscar en las palabras clave del usuario
            const keywordQuery = `
                SELECT DISTINCT c.id
                FROM user_category_keywords uck
                JOIN categories c ON c.id = uck.category_id
                WHERE $1 ILIKE ANY(uck.keywords)
                LIMIT 1
            `;
            const result = await this.pool.query(keywordQuery, [description]);
            
            if (result.rows.length > 0) {
                return result.rows[0].id;
            }

            // Si no hay coincidencia, obtener la categoría "Otros"
            const otrosQuery = 'SELECT id FROM categories WHERE LOWER(name_category) = \'otros\'';
            const otrosResult = await this.pool.query(otrosQuery);
            
            if (otrosResult.rows.length > 0) {
                return otrosResult.rows[0].id;
            }

            return null;
        } catch (error) {
            console.error('Error finding category:', error);
            return null;
        }
    }
} 