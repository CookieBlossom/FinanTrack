export interface IMovement {
  id?: number;
  cardId: number;
  categoryId?: number;
  amount: number;
  description?: string;
  movementType: 'income' | 'expense';
  movementSource: 'manual' | 'scrapper' | 'subscription' | 'projected';
  transactionDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}

export interface IMovementCreate {
  cardId: number;
  categoryId?: number;
  amount: number;
  description?: string;
  movementType: 'income' | 'expense';
  movementSource: 'manual' | 'scrapper' | 'subscription' | 'projected';
  transactionDate: Date;
  metadata?: Record<string, any>;
}

export interface IMovementUpdate extends Partial<IMovementCreate> {}

export interface IMovementFilters {
  cardId?: number;
  categoryId?: number;
  movementType?: 'income' | 'expense';
  movementSource?: 'manual' | 'scrapper' | 'subscription' | 'projected';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
} 