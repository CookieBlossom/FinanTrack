import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config();

export const pool: Pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'finantrack',
    port: parseInt(process.env.DB_PORT || '5432')
});

export async function initializeDatabase(): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        const schemaPath = path.join(__dirname, 'schema.sql'); // Ajusta la ruta si es necesario
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schema);
        console.log('Esquema ejecutado correctamente');
        return true;
    } catch (error) {
        console.error('Error al conectar con PostgreSQL:', error);
        throw error;
    } finally {
        if (client) {
            client.release();
        }
    }
} 