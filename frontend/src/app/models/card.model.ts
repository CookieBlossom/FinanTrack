export interface Card {
  id?: number;
  userId: number;
  nameAccount: string;
  cardTypeId: number;
  balance: number;
  aliasAccount?: string;
  currency: string;
  statusAccount: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
  cardType?: {
    id: number;
    name: string;
  };
}

export interface CardCreate {
  nameAccount: string;
  cardTypeId: number;
  balance: number;
  aliasAccount?: string;
  currency?: string; // Por defecto 'CLP'
}

export interface CardUpdate {
  nameAccount?: string;
  cardTypeId?: number;
  balance?: number;
  aliasAccount?: string;
  currency?: string;
  statusAccount?: 'active' | 'inactive';
} 