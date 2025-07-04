export interface IProjectedMovement {
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
  
  // Datos expandidos opcionales
  category?: {
    id: number;
    nameCategory: string;
    icon?: string;
    color?: string;
  };
  card?: {
    id: number;
    nameAccount: string;
    accountHolder?: string;
  };
}

export interface IProjectedMovementCreate {
  userId: number;
  categoryId?: number;
  cardId?: number;
  amount: number;
  description?: string;
  movementType: 'income' | 'expense';
  expectedDate: Date;
  probability?: number;
  recurrenceType?: 'monthly' | 'yearly' | 'weekly' | null;
}

export interface IProjectedMovementUpdate extends Partial<IProjectedMovementCreate> {
  status?: 'pending' | 'completed' | 'cancelled';
  actualMovementId?: number;
}

export interface IProjectedMovementFilters {
  userId?: number;
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