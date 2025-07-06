import Redis, { RedisOptions } from 'ioredis';
// import { ConfigService } from '@nestjs/config'; // No se usa directamente en Express, usamos process.env
// import { Injectable, OnModuleDestroy } from '@nestjs/common'; // No es necesario para Express

// Cargar dotenv para asegurar que process.env esté poblado
import dotenv from 'dotenv';
dotenv.config();

// @Injectable() // No es necesario para Express
export class RedisService { // quitamos OnModuleDestroy por ahora, manejar desconexión si es necesario en app.ts
  private readonly client: Redis;
  private readonly subscriber: Redis;
  private readonly subscribers: Map<string, (channel: string, message: string) => void>;

  constructor() {
    // Debug: mostrar configuración de Redis
    console.log('=== DEBUG REDIS CONFIG ===');
    console.log('REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'NOT SET');
    console.log('REDIS_HOST:', process.env.REDIS_HOST || 'NOT SET');
    console.log('REDIS_PORT:', process.env.REDIS_PORT || 'NOT SET');
    if (process.env.REDIS_URL) {
      console.log('REDIS_URL value:', process.env.REDIS_URL);
    }
    console.log('===============================');
    
    if (process.env.REDIS_URL) {
      this.client = new Redis(process.env.REDIS_URL);
      this.subscriber = new Redis(process.env.REDIS_URL);
    } else {
      const redisConfig: RedisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
      };
      this.client = new Redis(redisConfig);
      this.subscriber = new Redis(redisConfig);
    }

    this.subscribers = new Map();

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  
    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });

    this.subscriber.on('message', (channel: string, message: string) => {
      console.log(`Redis message received on channel ${channel}:`, message);
      const listener = this.subscribers.get(channel);
      if (listener) {
        listener(channel, message);
      }
    });

    this.subscriber.on('error', (err) => {
      console.error('Redis Subscriber Error:', err);
    });

    this.subscriber.on('connect', () => {
      console.log('Redis Subscriber Connected');
    });
  }
  // async onModuleDestroy() { // Quitar si no se usa el ciclo de vida de NestJS
  //   await this.client.quit();
  // }

  // Los métodos de Redis (set, get, del, etc.) permanecen iguales
  // ... (resto de los métodos sin cambios)
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.client.set(key, value, 'EX', ttl);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async rpush(key: string, value: string | string[]): Promise<number> {
    if (Array.isArray(value)) {
      return this.client.rpush(key, ...value);
    }
    return this.client.rpush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async flushall(): Promise<'OK'> {
    return this.client.flushall();
  }

  async hSet(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  // Método para desconectar manualmente si es necesario al cerrar la app Express
  async quit(): Promise<void> {
    await this.client.quit();
    console.log('Redis Client Disconnected');
  }

  async subscribe(channel: string, listener: (channel: string, message: string) => void): Promise<void> {
    console.log(`Subscribing to channel: ${channel}`);
    this.subscribers.set(channel, listener);
    await this.subscriber.subscribe(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    console.log(`Unsubscribing from channel: ${channel}`);
    this.subscribers.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  async publish(channel: string, message: string): Promise<number> {
    console.log(`Publishing to channel ${channel}:`, message);
    return this.client.publish(channel, message);
  }
} 