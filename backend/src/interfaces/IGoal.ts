export interface IGoal {
  id?: number;
  userId: number;
  categoryId: number;
  amountExpected: number;
  amountActual: number;
  goalPeriod: 'monthly' | 'yearly' | 'weekly';
  deadline: Date;
  goalDescription?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGoalCreate {
  categoryId: number;
  amountExpected: number;
  goalPeriod: 'monthly' | 'yearly' | 'weekly';
  deadline: Date;
  goalDescription?: string;
}

export interface IGoalUpdate extends Partial<IGoalCreate> {
  amountActual?: number;
} 