"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    jwtSecret: process.env.JWT_SECRET || 'tu_clave_secreta_por_defecto',
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'finantrack'
    },
    redis: {
        host: 'localhost',
        port: 6379,
        enableOfflineQueue: false
    }
};
//# sourceMappingURL=config.js.map