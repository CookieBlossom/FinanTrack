export interface ICard {
  id?: number;
  userId: number;
  nameAccount: string;
  aliasAccount?: string;
  cardTypeId: number;
  balance: number;
  currency: string;
  statusAccount: 'active' | 'inactive';
  source: 'manual' | 'scraper' | 'imported' | 'api';
  bankId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICardCreate {
  nameAccount: string;
  cardTypeId: number;
  balance: number;
  aliasAccount?: string;
  currency?: string;
  source?: 'manual' | 'scraper' | 'imported' | 'api'; // default: 'manual'
}

export interface ICardUpdate extends Partial<ICardCreate> {
  statusAccount?: 'active' | 'inactive';
}