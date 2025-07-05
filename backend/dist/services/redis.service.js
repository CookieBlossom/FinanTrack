"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// import { ConfigService } from '@nestjs/config'; // No se usa directamente en Express, usamos process.env
// import { Injectable, OnModuleDestroy } from '@nestjs/common'; // No es necesario para Express
// Cargar dotenv para asegurar que process.env esté poblado
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// @Injectable() // No es necesario para Express
class RedisService {
    constructor() {
        // Si existe REDIS_URL, úsala. Si no, usa host y puerto.
        this.client = process.env.REDIS_URL
            ? new ioredis_1.default(process.env.REDIS_URL)
            : new ioredis_1.default({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                retryStrategy: (times) => Math.min(times * 50, 2000),
            });
        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        this.client.on('connect', () => {
            console.log('Redis Client Connected');
        });
    }
    // async onModuleDestroy() { // Quitar si no se usa el ciclo de vida de NestJS
    //   await this.client.quit();
    // }
    // Los métodos de Redis (set, get, del, etc.) permanecen iguales
    // ... (resto de los métodos sin cambios)
    async set(key, value, ttl) {
        if (ttl) {
            return this.client.set(key, value, 'EX', ttl);
        }
        return this.client.set(key, value);
    }
    async get(key) {
        return this.client.get(key);
    }
    async del(key) {
        return this.client.del(key);
    }
    async keys(pattern) {
        return this.client.keys(pattern);
    }
    async rpush(key, value) {
        if (Array.isArray(value)) {
            return this.client.rpush(key, ...value);
        }
        return this.client.rpush(key, value);
    }
    async lpop(key) {
        return this.client.lpop(key);
    }
    async llen(key) {
        return this.client.llen(key);
    }
    async expire(key, seconds) {
        return this.client.expire(key, seconds);
    }
    async lrange(key, start, stop) {
        return this.client.lrange(key, start, stop);
    }
    async exists(key) {
        return this.client.exists(key);
    }
    async flushall() {
        return this.client.flushall();
    }
    async hSet(key, field, value) {
        return this.client.hset(key, field, value);
    }
    async hGet(key, field) {
        return this.client.hget(key, field);
    }
    // Método para desconectar manualmente si es necesario al cerrar la app Express
    async quit() {
        await this.client.quit();
        console.log('Redis Client Disconnected');
    }
}
exports.RedisService = RedisService;
//# sourceMappingURL=redis.service.js.map