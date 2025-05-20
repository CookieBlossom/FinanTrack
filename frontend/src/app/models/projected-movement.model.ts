export interface ProjectedMovement {
  id?: number;
  userId: number;
  categoryId?: number;
  cardId?: number;
  amount: number;
  description?: string;
  movementType: 'income' | 'expense';
  expectedDate: Date;
  probability?: number;
  status: 'pending' | 'completed' | 'cancelled';
  actualMovementId?: number;
  recurrenceType?: 'monthly' | 'yearly' | 'weekly' | null;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Propiedades expandidas para la UI
  category?: {
    id: number;
    nameCategory: string;
    icon?: string;
    color?: string;
  };
  card?: {
    id: number;
    nameAccount: string;
    aliasAccount?: string;
  };
  actualMovement?: {
    id: number;
    amount: number;
    transactionDate: Date;
  };
}

export interface ProjectedMovementCreate {
  categoryId?: number;
  cardId?: number;
  amount: number;
  description?: string;
  movementType: 'income' | 'expense';
  expectedDate: Date;
  probability?: number;
  recurrenceType?: 'monthly' | 'yearly' | 'weekly' | null;
}

export interface ProjectedMovementUpdate {
  categoryId?: number;
  cardId?: number;
  amount?: number;
  description?: string;
  movementType?: 'income' | 'expense';
  expectedDate?: Date;
  probability?: number;
  status?: 'pending' | 'completed' | 'cancelled';
  actualMovementId?: number;
  recurrenceType?: 'monthly' | 'yearly' | 'weekly' | null;
}

export interface ProjectedMovementFilters {
  categoryId?: number;
  cardId?: number;
  movementType?: 'income' | 'expense';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  minProbability?: number;
  maxProbability?: number;
  status?: 'pending' | 'completed' | 'cancelled';
  recurrenceType?: 'monthly' | 'yearly' | 'weekly' | null;
} 