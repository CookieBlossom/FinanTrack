export interface ICard {
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
}

export interface ICardCreate {
  nameAccount: string;
  cardTypeId: number;
  balance: number;
  aliasAccount?: string;
  currency?: string; // Defaults to 'CLP'
}

export interface ICardUpdate extends Partial<ICardCreate> {
  statusAccount?: 'active' | 'inactive';
} 