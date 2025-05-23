import { pool } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';

async function resetDatabase() {
    try {
        console.log('Iniciando reinicio de la base de datos...');
        
        // Leer el archivo schema.sql
        const schemaPath = join(__dirname, 'schema.sql');
        const schemaSql = readFileSync(schemaPath, 'utf8');
        
        console.log('Ejecutando script SQL...');
        await pool.query(schemaSql);
        
        console.log('Base de datos reiniciada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('Error al reiniciar la base de datos:', error);
        process.exit(1);
    }
}

resetDatabase(); 