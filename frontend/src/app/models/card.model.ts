import { ScraperTask, ScraperResult } from './scraper.model';

export interface Card {
  id: number;
  userId: number;
  nameAccount: string;
  accountHolder?: string;
  cardTypeId: number;
  balance: number;
  balanceSource: 'manual' | 'cartola';
  lastBalanceUpdate?: Date;
  statusAccount: 'active' | 'inactive';
  source: 'manual' | 'scraper' | 'imported' | 'api';
  bankId?: number;
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
  accountHolder?: string;
  cardTypeId: number;
  balance: number;
  balanceSource?: 'manual' | 'cartola';
  source?: 'manual' | 'scraper' | 'imported' | 'api';
  bankId?: number;
}

export interface CardUpdate extends Partial<CardCreate> {
  statusAccount?: 'active' | 'inactive';
}

export interface CardCredentials {
  rut: string;
  password: string;
  site?: string;
} 