export interface Movement {
  id: number;
  cardId: number;
  categoryId?: number;
  amount: number;
  description: string;
  movementType: 'income' | 'expense';
  movementSource: 'manual' | 'scraper' | 'subscription' | 'projected' | 'cartola';
  transactionDate: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    originalData?: any;
    cuenta?: string;
    referencia?: string;
    estado?: string;
    tipo?: string;
    [key: string]: any;
  };

  // Datos expandidos opcionales
  card?: {
    id: number;
    nameAccount: string;
    aliasAccount?: string;
  };
  category?: {
    id: number;
    nameCategory: string;
    color?: string;
  };
}

export interface MovementCreate {
  cardId: number;
  categoryId?: number;
  amount: number;
  description: string;
  movementType: 'income' | 'expense';
  movementSource: 'manual' | 'scraper' | 'subscription' | 'projected' | 'cartola';
  transactionDate: Date;
  metadata?: Record<string, any>;
}

export interface MovementUpdate {
  cardId?: number;
  categoryId?: number;
  amount?: number;
  description?: string;
  movementType?: 'income' | 'expense';
  movementSource?: 'manual' | 'scraper' | 'subscription' | 'projected' | 'cartola';
  transactionDate?: Date;
  metadata?: Record<string, any>;
}

export interface MovementFilters {
  userId?: number; // requerido en backend
  cardId?: number;
  categoryId?: number;
  movementType?: 'income' | 'expense';
  movementSource?: 'manual' | 'scraper' | 'subscription' | 'projected' | 'cartola';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}