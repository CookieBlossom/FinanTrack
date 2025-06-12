import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CardService } from './card.service';
import { MovementService } from './movement.service';
import { ScraperModule } from './scrapers/scraper.module';

@Module({
  imports: [
    ConfigModule,
    ScraperModule
  ],
  providers: [
    CardService,
    MovementService
  ],
  exports: [
    CardService,
    MovementService,
    ScraperModule
  ]
})
export class ServicesModule {} 