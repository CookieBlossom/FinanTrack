import { pool } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';

async function resetDatabase() {
    const client = await pool.connect();
    try {
        console.log('Iniciando reinicio de la base de datos...');
        
        // Leer el archivo schema.sql
        const schemaPath = join(__dirname, 'schema.sql');
        console.log('Leyendo archivo schema.sql desde:', schemaPath);
        const schemaSql = readFileSync(schemaPath, 'utf8');
        
        // Iniciar una transacción
        await client.query('BEGIN');
        
        console.log('Ejecutando script SQL...');
        await client.query(schemaSql);
        
        // Confirmar la transacción
        await client.query('COMMIT');
        
        console.log('Base de datos reiniciada exitosamente');
    } catch (error) {
        // Revertir la transacción en caso de error
        await client.query('ROLLBACK');
        console.error('Error al reiniciar la base de datos:', error);
        throw error;
    } finally {
        // Liberar el cliente y cerrar la conexión
        client.release();
        await pool.end();
        console.log('Conexión cerrada');
    }
}

// Ejecutar el script
resetDatabase()
    .then(() => {
        console.log('Proceso completado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error en el proceso:', error);
        process.exit(1);
    }); 