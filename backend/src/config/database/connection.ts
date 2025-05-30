import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

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
        console.log('Conexión a PostgreSQL establecida correctamente');
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