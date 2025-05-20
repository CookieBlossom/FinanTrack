export interface Movement {
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
  
  // Propiedades expandidas para la UI
  card?: {
    id: number;
    nameAccount: string;
    aliasAccount?: string;
  };
  category?: {
    id: number;
    nameCategory: string;
    icon?: string;
    color?: string;
  };
}

export interface MovementCreate {
  cardId: number;
  categoryId?: number;
  amount: number;
  description?: string;
  movementType: 'income' | 'expense';
  movementSource: 'manual' | 'scrapper' | 'subscription' | 'projected';
  transactionDate: Date;
  metadata?: Record<string, any>;
}

export interface MovementUpdate {
  cardId?: number;
  categoryId?: number;
  amount?: number;
  description?: string;
  movementType?: 'income' | 'expense';
  movementSource?: 'manual' | 'scrapper' | 'subscription' | 'projected';
  transactionDate?: Date;
  metadata?: Record<string, any>;
}

export interface MovementFilters {
  cardId?: number;
  categoryId?: number;
  movementType?: 'income' | 'expense';
  movementSource?: 'manual' | 'scrapper' | 'subscription' | 'projected';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
} 