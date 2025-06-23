import dotenv from 'dotenv';
import { stripe } from '../config/stripe';
import { pool } from '../config/database/connection';
import { DatabaseError } from '../utils/errors';
import { Pool } from 'pg';
import { Stripe } from 'stripe';
dotenv.config();

export class StripeService {
    private db: Pool = pool;

    // Mapeo de price IDs de Stripe a nombres de planes
    public async getPlanNameFromPriceId(priceId: string): Promise<string> {
        try {
            // Obtener el precio desde Stripe
            const price = await stripe.prices.retrieve(priceId, {
                expand: ['product']
            });
            
            // Obtener el nombre del producto
            const productName = (price.product as Stripe.Product).name?.toLowerCase() || '';
            
            // Mapear basado en el nombre del producto
            if (productName.includes('pro')) {
                return 'pro';
            } else if (productName.includes('premium')) {
                return 'premium';
            } else if (productName.includes('basic') || productName.includes('básico')) {
                return 'basic';
            } else if (productName.includes('free') || productName.includes('gratis')) {
                return 'free';
            }
            
            // Mapeo de respaldo para price IDs específicos
            const priceToPlanMap: { [key: string]: string } = {
                'price_basic': 'basic',
                'price_premium': 'premium', 
                'price_pro': 'pro',
                'price_1RcdQLIJmAE0NFjM3hX6ia7w': 'premium',
                'price_1RcdQLIJmAE0NFjM3hX6ia7x': 'basic',
                'price_1RcdQLIJmAE0NFjM3hX6ia7y': 'pro'
            };
            
            return priceToPlanMap[priceId] || 'basic';
        } catch (error) {
            console.error('Error obteniendo plan desde price ID:', error);
            return 'basic'; // Por defecto
        }
    }
    async createCheckoutSession(userId: number, priceId: string, successUrl: string, cancelUrl: string, userEmail?: string) {
        try {
            // Primero obtener el precio desde Stripe para obtener el monto
            const price = await stripe.prices.retrieve(priceId);
            const amount = price.unit_amount || 0; // amount está en centavos
            
            // Crea un registro provisional en payments con el monto
            const { rows } = await this.db.query(`
              INSERT INTO payments (user_id, amount, payment_method, status, stripe_price_id, created_at, description)
              VALUES ($1, $2, 'stripe', 'pending', $3, NOW(), $4)
              RETURNING id
            `, [userId, amount / 100, priceId, `Suscripción Stripe price ${priceId}`]);
            const paymentRecordId = rows[0].id;
        
            const sessionData: Stripe.Checkout.SessionCreateParams = {
              mode: 'subscription',
              line_items: [{ price: priceId, quantity: 1 }],
              metadata: { paymentRecordId: String(paymentRecordId), userId: String(userId) },
              success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
              cancel_url: cancelUrl
            };

            // Agregar email del cliente si está disponible
            if (userEmail) {
              sessionData.customer_email = userEmail;
            }
        
            const session = await stripe.checkout.sessions.create(sessionData);
            return session.url;
        } catch (error) {
            console.error('Error en createCheckoutSession:', error);
            throw error;
        }
    }
    
    /** Maneja eventos de webhook de Stripe */
    async handleWebhook(rawBody: Buffer, sig: string) {
        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
          console.log(`📦 Webhook recibido: ${event.type}`);
        } catch (err) {
          console.error('❌ Error en webhook signature:', err);
          throw new Error('Webhook signature mismatch');
        }
    
        switch (event.type) {
          case 'checkout.session.completed':
            console.log('✅ Procesando checkout.session.completed');
            const session = event.data.object as Stripe.Checkout.Session;
            const paymentRecordId = Number(session.metadata?.paymentRecordId);
            const userId = Number(session.metadata?.userId);
            const subscriptionId = session.subscription as string;
            
            console.log(`👤 Usuario: ${userId}, Pago: ${paymentRecordId}, Suscripción: ${subscriptionId}`);
            console.log(`🔗 Session ID: ${session.id}`);
            
            // Verificar que tenemos los datos necesarios
            if (!paymentRecordId || !userId) {
              console.error('❌ Datos faltantes en metadata:', session.metadata);
              break;
            }
            
            // Actualiza estado del pago con información de Stripe
            await this.db.query(`
              UPDATE payments
              SET status = 'completed', 
                  stripe_session_id = $1,
                  stripe_subscription_id = $2,
                  expires_at = NOW() + INTERVAL '1 month',
                  updated_at = NOW()
              WHERE id = $3
            `, [session.id, subscriptionId, paymentRecordId]);
            
            console.log('💳 Pago actualizado como completado');
            
            // Obtener el price ID de la línea de items
            const lineItems = session.line_items?.data;
            const priceId = lineItems?.[0]?.price?.id;
            console.log(`💰 Price ID: ${priceId}`);
            
            const planName = priceId ? await this.getPlanNameFromPriceId(priceId) : 'free'; 
            console.log(`📋 Plan detectado: ${planName}`);
            
            // Obtener el ID del plan desde la base de datos
            const planResult = await this.db.query(`
              SELECT id, name FROM plans WHERE name = $1
            `, [planName]);
            
            if (planResult.rows.length === 0) {
              console.error(`❌ Plan no encontrado: ${planName}`);
              break;
            }
            
            const planId = planResult.rows[0].id;
            console.log(`🆔 ID del plan: ${planId}`);
            
            // Actualiza plan del usuario
            await this.db.query(`
              UPDATE "user"
              SET plan_id = $1, updated_at = NOW()
              WHERE id = $2
            `, [planId, userId]);
            
            console.log(`✅ Usuario ${userId} actualizado al plan ${planName} (ID: ${planId})`);
            
            // Verificar que se actualizó correctamente
            const userCheck = await this.db.query(`
              SELECT u.plan_id, pl.name as plan_name 
              FROM "user" u 
              LEFT JOIN plans pl ON u.plan_id = pl.id 
              WHERE u.id = $1
            `, [userId]);
            
            if (userCheck.rows.length > 0) {
              console.log(`🔍 Verificación: Usuario ${userId} ahora tiene plan_id: ${userCheck.rows[0].plan_id}, plan_name: ${userCheck.rows[0].plan_name}`);
            }
            break;
    
          case 'customer.subscription.updated':
            console.log('🔄 Procesando customer.subscription.updated');
            // Aquí podrías manejar cambios en la suscripción
            break;
            
          case 'customer.subscription.deleted':
            console.log('🗑️ Procesando customer.subscription.deleted');
            // Aquí podrías manejar cancelaciones
            break;
    
          // maneja otros eventos si los necesitas
          default:
            console.log(`ℹ️ Evento no manejado: ${event.type}`);
        }
    }
}