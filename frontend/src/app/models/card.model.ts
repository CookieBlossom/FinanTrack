import { ScraperTask, ScraperResult } from './scraper.model';

export interface Card {
  id: number;
  userId: number;
  nameAccount: string;
  aliasAccount?: string;
  cardTypeId: number;
  balance: number;
  currency: string;
  statusAccount: 'active' | 'inactive';
  source: 'manual' | 'scraper' | 'imported' | 'api';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CardType {
  id: number;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Bank {
  id: number;
  name: string;
}

export interface CardCreate {
  nameAccount: string;
  cardTypeId: number;
  balance: number;
  aliasAccount?: string;
  currency?: string;
  source?: 'manual' | 'scraper' | 'imported' | 'api'; 
}

export interface CardUpdate extends Partial<CardCreate> {
  statusAccount?: 'active' | 'inactive';
}

export interface CardCredentials {
  rut: string;
  password: string;
  site?: string;
} 