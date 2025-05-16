export interface ISubscription {
  id?: number;
  userId: number;
  categoryId?: number;
  name: string;
  amount: number;
  description?: string;
  billingPeriod: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate: Date;
  paymentMethodId?: number; // ID de la tarjeta
  status: 'active' | 'paused' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISubscriptionCreate {
  userId: number;
  categoryId?: number;
  name: string;
  amount: number;
  description?: string;
  billingPeriod: 'monthly' | 'yearly' | 'weekly';
  nextBillingDate: Date;
  paymentMethodId?: number;
}

export interface ISubscriptionUpdate extends Partial<ISubscriptionCreate> {
  status?: 'active' | 'paused' | 'cancelled';
}

export interface ISubscriptionFilters {
  userId?: number;
  categoryId?: number;
  paymentMethodId?: number;
  billingPeriod?: 'monthly' | 'yearly' | 'weekly';
  status?: 'active' | 'paused' | 'cancelled';
  minAmount?: number;
  maxAmount?: number;
  startDate?: Date;
  endDate?: Date;
} 