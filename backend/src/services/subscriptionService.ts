import { Pool } from 'pg';
import { ISubscription, ISubscriptionCreate, ISubscriptionUpdate, ISubscriptionFilters } from '../interfaces/ISubscription';
import { pool } from '../config/database/connection';

export class SubscriptionService {
    private pool: Pool;

    constructor() {
        this.pool = pool;
    }

    async getAllSubscriptions(userId: number): Promise<ISubscription[]> {
        const query = `
            SELECT 
                id, user_id as "userId", category_id as "categoryId",
                name, amount, description, billing_period as "billingPeriod",
                next_billing_date as "nextBillingDate",
                payment_method_id as "paymentMethodId", status,
                created_at as "createdAt", updated_at as "updatedAt"
            FROM subscriptions
            WHERE user_id = $1
            ORDER BY next_billing_date ASC
        `;
        const result = await this.pool.query(query, [userId]);
        return result.rows;
    }

    async getSubscriptionById(id: number, userId: number): Promise<ISubscription | null> {
        const query = `
            SELECT 
                id, user_id as "userId", category_id as "categoryId",
                name, amount, description, billing_period as "billingPeriod",
                next_billing_date as "nextBillingDate",
                payment_method_id as "paymentMethodId", status,
                created_at as "createdAt", updated_at as "updatedAt"
            FROM subscriptions
            WHERE id = $1 AND user_id = $2
        `;
        const result = await this.pool.query(query, [id, userId]);
        return result.rows[0] || null;
    }

    async getSubscriptionsByFilters(filters: ISubscriptionFilters): Promise<ISubscription[]> {
        const conditions: string[] = ['user_id = $1'];
        const values: any[] = [filters.userId];
        let paramCount = 1;

        if (filters.categoryId) {
            paramCount++;
            conditions.push(`category_id = $${paramCount}`);
            values.push(filters.categoryId);
        }

        if (filters.paymentMethodId) {
            paramCount++;
            conditions.push(`payment_method_id = $${paramCount}`);
            values.push(filters.paymentMethodId);
        }

        if (filters.billingPeriod) {
            paramCount++;
            conditions.push(`billing_period = $${paramCount}`);
            values.push(filters.billingPeriod);
        }

        if (filters.status) {
            paramCount++;
            conditions.push(`status = $${paramCount}`);
            values.push(filters.status);
        }

        if (filters.minAmount) {
            paramCount++;
            conditions.push(`amount >= $${paramCount}`);
            values.push(filters.minAmount);
        }

        if (filters.maxAmount) {
            paramCount++;
            conditions.push(`amount <= $${paramCount}`);
            values.push(filters.maxAmount);
        }

        if (filters.startDate) {
            paramCount++;
            conditions.push(`next_billing_date >= $${paramCount}`);
            values.push(filters.startDate);
        }

        if (filters.endDate) {
            paramCount++;
            conditions.push(`next_billing_date <= $${paramCount}`);
            values.push(filters.endDate);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                id, user_id as "userId", category_id as "categoryId",
                name, amount, description, billing_period as "billingPeriod",
                next_billing_date as "nextBillingDate",
                payment_method_id as "paymentMethodId", status,
                created_at as "createdAt", updated_at as "updatedAt"
            FROM subscriptions
            ${whereClause}
            ORDER BY next_billing_date ASC
        `;

        const result = await this.pool.query(query, values);
        return result.rows;
    }

    async createSubscription(subscriptionData: ISubscriptionCreate): Promise<ISubscription> {
        const query = `
            INSERT INTO subscriptions (
                user_id, category_id, name, amount,
                description, billing_period, next_billing_date,
                payment_method_id, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, 'active'
            )
            RETURNING 
                id, user_id as "userId", category_id as "categoryId",
                name, amount, description, billing_period as "billingPeriod",
                next_billing_date as "nextBillingDate",
                payment_method_id as "paymentMethodId", status,
                created_at as "createdAt", updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, [
            subscriptionData.userId,
            subscriptionData.categoryId,
            subscriptionData.name,
            subscriptionData.amount,
            subscriptionData.description,
            subscriptionData.billingPeriod,
            subscriptionData.nextBillingDate,
            subscriptionData.paymentMethodId
        ]);

        return result.rows[0];
    }

    async updateSubscription(
        id: number,
        userId: number,
        subscriptionData: ISubscriptionUpdate
    ): Promise<ISubscription | null> {
        const currentSubscription = await this.getSubscriptionById(id, userId);
        if (!currentSubscription) return null;

        const updateFields: string[] = [];
        const values: any[] = [];
        let paramCount = 0;

        const updateData: Record<string, any> = {
            category_id: subscriptionData.categoryId,
            name: subscriptionData.name,
            amount: subscriptionData.amount,
            description: subscriptionData.description,
            billing_period: subscriptionData.billingPeriod,
            next_billing_date: subscriptionData.nextBillingDate,
            payment_method_id: subscriptionData.paymentMethodId,
            status: subscriptionData.status
        };

        for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined) {
                paramCount++;
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
            }
        }

        if (updateFields.length === 0) return currentSubscription;

        // Agregar updated_at
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Agregar id y userId para el WHERE
        paramCount++;
        values.push(id);
        paramCount++;
        values.push(userId);

        const query = `
            UPDATE subscriptions
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
            RETURNING 
                id, user_id as "userId", category_id as "categoryId",
                name, amount, description, billing_period as "billingPeriod",
                next_billing_date as "nextBillingDate",
                payment_method_id as "paymentMethodId", status,
                created_at as "createdAt", updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async deleteSubscription(id: number, userId: number): Promise<boolean> {
        const query = 'DELETE FROM subscriptions WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await this.pool.query(query, [id, userId]);
        return result.rowCount !== null && result.rowCount > 0;
    }

    async updateNextBillingDate(id: number, userId: number): Promise<ISubscription | null> {
        const subscription = await this.getSubscriptionById(id, userId);
        if (!subscription) return null;

        let nextDate = new Date(subscription.nextBillingDate);
        
        switch (subscription.billingPeriod) {
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
        }

        const query = `
            UPDATE subscriptions
            SET next_billing_date = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING 
                id, user_id as "userId", category_id as "categoryId",
                name, amount, description, billing_period as "billingPeriod",
                next_billing_date as "nextBillingDate",
                payment_method_id as "paymentMethodId", status,
                created_at as "createdAt", updated_at as "updatedAt"
        `;

        const result = await this.pool.query(query, [nextDate, id, userId]);
        return result.rows[0];
    }
} 