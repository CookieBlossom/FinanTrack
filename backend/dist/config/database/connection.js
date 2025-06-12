"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initializeDatabase = initializeDatabase;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'finantrack',
    port: parseInt(process.env.DB_PORT || '5432')
});
async function initializeDatabase() {
    let client = null;
    try {
        client = await exports.pool.connect();
        console.log('Conexión a PostgreSQL establecida correctamente');
        return true;
    }
    catch (error) {
        console.error('Error al conectar con PostgreSQL:', error);
        throw error;
    }
    finally {
        if (client) {
            client.release();
        }
    }
}
//# sourceMappingURL=connection.js.map