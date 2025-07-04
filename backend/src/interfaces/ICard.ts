export interface ICard {
  id: number;
  userId: number;
  nameAccount: string;
  accountHolder?: string;
  balance: number;
  balanceSource: 'manual' | 'cartola';
  lastBalanceUpdate?: Date;
  statusAccount: 'active' | 'inactive';
  source: 'manual' | 'scraper' | 'imported' | 'api';
  cardTypeId: number;
  bankId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICardCreate {
  nameAccount: string;
  accountHolder?: string;
  cardTypeId: number;
  balance: number;
  balanceSource?: 'manual' | 'cartola';
  source?: 'manual' | 'scraper' | 'imported' | 'api';
  bankId?: number;
  userId?: number;
}

export interface ICardUpdate extends Partial<ICardCreate> {
  statusAccount?: 'active' | 'inactive';
}