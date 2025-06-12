import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from '../redis.service';
import { ScraperService } from './scraper.service';
import { BancoEstadoService } from './banco-estado/banco-estado.service';

@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    ScraperService,
    BancoEstadoService
  ],
  exports: [
    ScraperService,
    BancoEstadoService
  ]
})
export class ScraperModule {} 