import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config();

// Configuración inteligente para Railway/local
const getDatabaseConfig = () => {
    // Debug: mostrar variables de entorno relevantes
    console.log('=== DEBUG DATABASE CONFIG ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
    console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
    console.log('===============================');
    
    // Si existe DATABASE_URL (Railway/Heroku style), usarla
    if (process.env.DATABASE_URL) {
        console.log('Usando DATABASE_URL para conexión');
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
    }
    
    // Si no, usar variables individuales (desarrollo local)
    console.log('Usando variables individuales para conexión');
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'finantrack',
        port: parseInt(process.env.DB_PORT || '5432')
    };
};

export const pool: Pool = new Pool(getDatabaseConfig());

export async function initializeDatabase(): Promise<boolean> {
    let client: PoolClient | null = null;
    try {
        console.log('Intentando conectar a la base de datos...');
        client = await pool.connect();
        console.log('Conexión a PostgreSQL exitosa');
        
        // Solo ejecutar schema en desarrollo o si está explícitamente habilitado
        if (process.env.NODE_ENV !== 'production' || process.env.FORCE_SCHEMA_INIT === 'true') {
            console.log('Ejecutando schema SQL...');
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await client.query(schema);
            console.log('Esquema ejecutado correctamente');
        } else {
            console.log('Modo producción: omitiendo inicialización de schema');
        }
        
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