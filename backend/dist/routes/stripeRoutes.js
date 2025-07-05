"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_service_1 = require("../services/stripe.service");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
const stripeService = new stripe_service_1.StripeService();
// Endpoint de prueba para verificar que Stripe funciona
router.get('/test', async (req, res) => {
    try {
        const { stripe } = await Promise.resolve().then(() => __importStar(require('../config/stripe')));
        const account = await stripe.accounts.retrieve();
        // También obtener algunos precios para verificar
        const prices = await stripe.prices.list({
            active: true,
            limit: 5,
            expand: ['data.product']
        });
        res.json({
            success: true,
            message: 'Stripe está funcionando correctamente',
            account: {
                email: account.email,
                country: account.country
            },
            prices: prices.data.map(price => ({
                id: price.id,
                amount: price.unit_amount,
                currency: price.currency,
                product: {
                    name: price.product.name,
                    description: price.product.description
                }
            }))
        });
    }
    catch (error) {
        console.error('Error en test de Stripe:', error);
        res.status(500).json({
            success: false,
            message: 'Error conectando con Stripe',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Crear sesión de checkout
router.post('/create-checkout-session', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { priceId, successUrl, cancelUrl } = req.body;
        const userId = req.user.id;
        const userEmail = req.user.email;
        console.log('Creando sesión de checkout:', { priceId, successUrl, cancelUrl, userId, userEmail });
        if (!priceId || !successUrl || !cancelUrl) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos: priceId, successUrl, cancelUrl'
            });
        }
        const checkoutUrl = await stripeService.createCheckoutSession(userId, priceId, successUrl, cancelUrl, userEmail);
        console.log('Sesión de checkout creada exitosamente:', checkoutUrl);
        res.json({
            success: true,
            checkoutUrl
        });
    }
    catch (error) {
        console.error('Error creando sesión de checkout:', error);
        // Proporcionar más detalles del error
        const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';
        const errorDetails = error instanceof Error ? error.stack : 'Sin detalles disponibles';
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        });
    }
});
// Webhook de Stripe (no requiere autenticación)
router.post('/webhook', async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            return res.status(400).json({
                success: false,
                message: 'Falta stripe-signature header'
            });
        }
        await stripeService.handleWebhook(req.body, sig);
        res.json({ received: true });
    }
    catch (error) {
        console.error('Error en webhook:', error);
        res.status(400).json({
            success: false,
            message: 'Error en webhook'
        });
    }
});
// Obtener información de precios (para desarrollo)
router.get('/prices', async (req, res) => {
    try {
        const { stripe } = await Promise.resolve().then(() => __importStar(require('../config/stripe')));
        const prices = await stripe.prices.list({
            active: true,
            expand: ['data.product']
        });
        res.json({
            success: true,
            prices: prices.data
        });
    }
    catch (error) {
        console.error('Error obteniendo precios:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo precios'
        });
    }
});
// Verificar estado del pago y actualizar token
router.get('/verify-payment', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { session_id } = req.query;
        const userId = req.user.id;
        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: 'session_id es requerido'
            });
        }
        console.log(`🔍 Verificando pago para sesión: ${session_id}, usuario: ${userId}`);
        // Buscar el pago en la base de datos
        const paymentResult = await stripeService['db'].query(`
      SELECT p.*, u.plan_id, pl.name as plan_name
      FROM payments p
      JOIN "user" u ON p.user_id = u.id
      LEFT JOIN plans pl ON u.plan_id = pl.id
      WHERE p.stripe_session_id = $1 AND p.user_id = $2
    `, [session_id, userId]);
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pago no encontrado'
            });
        }
        const payment = paymentResult.rows[0];
        console.log(`📊 Estado del pago: ${payment.status}, Plan: ${payment.plan_name}`);
        if (payment.status === 'completed') {
            // Generar nuevo token con el plan actualizado
            const jwt = require('jsonwebtoken');
            const newToken = jwt.sign({
                id: userId,
                email: req.user.email,
                name: req.user.name,
                role: req.user.role,
                planId: payment.plan_id,
                planName: payment.plan_name
            }, process.env.JWT_SECRET, { expiresIn: '1h' });
            console.log(`🔄 Token actualizado para usuario ${userId} con plan ${payment.plan_name}`);
            res.json({
                success: true,
                message: 'Pago verificado exitosamente',
                payment: {
                    status: payment.status,
                    planName: payment.plan_name,
                    planId: payment.plan_id,
                    amount: payment.amount,
                    currency: payment.currency
                },
                newToken
            });
        }
        else {
            res.json({
                success: false,
                message: 'Pago aún no completado',
                payment: {
                    status: payment.status,
                    planName: payment.plan_name,
                    planId: payment.plan_id
                }
            });
        }
    }
    catch (error) {
        console.error('Error verificando pago:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Verificar estado del pago sin autenticación (para retorno de Stripe)
router.get('/verify-payment-public', async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: 'session_id es requerido'
            });
        }
        console.log(`🔍 Verificando pago público para sesión: ${session_id}`);
        // Buscar el pago en la base de datos (incluyendo pendientes)
        const paymentResult = await stripeService['db'].query(`
      SELECT p.*, u.plan_id, pl.name as plan_name, u.email, u.first_name, u.last_name, u.role
      FROM payments p
      JOIN "user" u ON p.user_id = u.id
      LEFT JOIN plans pl ON u.plan_id = pl.id
      WHERE p.stripe_session_id = $1 OR p.stripe_price_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 1
    `, [session_id]);
        if (paymentResult.rows.length === 0) {
            console.log(`❌ Pago no encontrado para sesión: ${session_id}`);
            // Buscar pagos recientes para debug
            const recentPayments = await stripeService['db'].query(`
        SELECT p.stripe_session_id, p.status, p.created_at, u.email
        FROM payments p
        JOIN "user" u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 5
      `);
            console.log('📋 Pagos recientes:', recentPayments.rows);
            return res.status(404).json({
                success: false,
                message: 'Pago no encontrado',
                debug: {
                    sessionId: session_id,
                    recentPayments: recentPayments.rows
                }
            });
        }
        const payment = paymentResult.rows[0];
        const userId = payment.user_id;
        console.log(`📊 Estado del pago: ${payment.status}, Plan: ${payment.plan_name}, Usuario: ${userId}`);
        if (payment.status === 'completed') {
            // Generar nuevo token con el plan actualizado
            const jwt = require('jsonwebtoken');
            const newToken = jwt.sign({
                id: userId,
                email: payment.email,
                name: payment.email, // Usar email como nombre por defecto
                role: payment.role,
                planId: payment.plan_id,
                planName: payment.plan_name
            }, process.env.JWT_SECRET, { expiresIn: '1h' });
            console.log(`🔄 Token actualizado para usuario ${userId} con plan ${payment.plan_name}`);
            res.json({
                success: true,
                message: 'Pago verificado exitosamente',
                payment: {
                    status: payment.status,
                    planName: payment.plan_name,
                    planId: payment.plan_id,
                    amount: payment.amount,
                    currency: payment.currency
                },
                newToken
            });
        }
        else {
            console.log(`⏳ Pago aún no completado. Estado: ${payment.status}`);
            res.json({
                success: false,
                message: 'Pago aún no completado',
                payment: {
                    status: payment.status,
                    planName: payment.plan_name,
                    planId: payment.plan_id,
                    amount: payment.amount,
                    currency: payment.currency
                },
                debug: {
                    sessionId: session_id,
                    paymentId: payment.id,
                    userId: userId
                }
            });
        }
    }
    catch (error) {
        console.error('Error verificando pago público:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Verificar estado de pagos y webhooks (para debugging)
router.get('/debug-payments', async (req, res) => {
    try {
        const { session_id } = req.query;
        if (session_id) {
            // Buscar un pago específico
            const paymentResult = await stripeService['db'].query(`
        SELECT p.*, u.plan_id, pl.name as plan_name, u.email
        FROM payments p
        JOIN "user" u ON p.user_id = u.id
        LEFT JOIN plans pl ON u.plan_id = pl.id
        WHERE p.stripe_session_id = $1
      `, [session_id]);
            if (paymentResult.rows.length > 0) {
                const payment = paymentResult.rows[0];
                res.json({
                    success: true,
                    payment: {
                        id: payment.id,
                        userId: payment.user_id,
                        status: payment.status,
                        planName: payment.plan_name,
                        planId: payment.plan_id,
                        amount: payment.amount,
                        stripeSessionId: payment.stripe_session_id,
                        stripeSubscriptionId: payment.stripe_subscription_id,
                        createdAt: payment.created_at,
                        updatedAt: payment.updated_at
                    }
                });
            }
            else {
                res.json({
                    success: false,
                    message: 'Pago no encontrado'
                });
            }
        }
        else {
            // Listar todos los pagos recientes
            const paymentsResult = await stripeService['db'].query(`
        SELECT p.*, u.plan_id, pl.name as plan_name, u.email
        FROM payments p
        JOIN "user" u ON p.user_id = u.id
        LEFT JOIN plans pl ON u.plan_id = pl.id
        ORDER BY p.created_at DESC
        LIMIT 10
      `);
            res.json({
                success: true,
                payments: paymentsResult.rows.map(payment => ({
                    id: payment.id,
                    userId: payment.user_id,
                    status: payment.status,
                    planName: payment.plan_name,
                    planId: payment.plan_id,
                    amount: payment.amount,
                    stripeSessionId: payment.stripe_session_id,
                    stripeSubscriptionId: payment.stripe_subscription_id,
                    createdAt: payment.created_at,
                    updatedAt: payment.updated_at
                }))
            });
        }
    }
    catch (error) {
        console.error('Error en debug-payments:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Simular webhook para pagos pendientes (para debugging)
router.post('/simulate-webhook', async (req, res) => {
    try {
        const { session_id, payment_id } = req.body;
        if (!session_id || !payment_id) {
            return res.status(400).json({
                success: false,
                message: 'session_id y payment_id son requeridos'
            });
        }
        console.log(`🔄 Simulando webhook para sesión: ${session_id}, pago: ${payment_id}`);
        // Obtener información del pago
        const paymentResult = await stripeService['db'].query(`
      SELECT p.*, u.id as user_id, u.email
      FROM payments p
      JOIN "user" u ON p.user_id = u.id
      WHERE p.id = $1
    `, [payment_id]);
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pago no encontrado'
            });
        }
        const payment = paymentResult.rows[0];
        const userId = payment.user_id;
        // Actualizar el pago como completado
        await stripeService['db'].query(`
      UPDATE payments
      SET status = 'completed', 
          stripe_session_id = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [session_id, payment_id]);
        // Obtener el plan basado en el stripe_price_id
        const planName = await stripeService['getPlanNameFromPriceId'](payment.stripe_price_id);
        console.log(`📋 Plan detectado: ${planName}`);
        // Obtener el ID del plan desde la base de datos
        const planResult = await stripeService['db'].query(`
      SELECT id, name FROM plans WHERE name = $1
    `, [planName]);
        if (planResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: `Plan no encontrado: ${planName}`
            });
        }
        const planId = planResult.rows[0].id;
        // Actualizar plan del usuario
        await stripeService['db'].query(`
      UPDATE "user"
      SET plan_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [planId, userId]);
        console.log(`✅ Usuario ${userId} actualizado al plan ${planName} (ID: ${planId})`);
        res.json({
            success: true,
            message: 'Webhook simulado exitosamente',
            payment: {
                id: payment_id,
                status: 'completed',
                planName: planName,
                planId: planId
            }
        });
    }
    catch (error) {
        console.error('Error simulando webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Simular webhook manualmente usando session_id
router.post('/simulate-webhook-by-session', async (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: 'session_id es requerido'
            });
        }
        console.log(`🔄 Simulando webhook para sesión: ${session_id}`);
        // Buscar el pago por session_id
        const paymentResult = await stripeService['db'].query(`
      SELECT p.*, u.id as user_id, u.email
      FROM payments p
      JOIN "user" u ON p.user_id = u.id
      WHERE p.stripe_session_id = $1 OR p.stripe_price_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 1
    `, [session_id]);
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pago no encontrado para esta sesión'
            });
        }
        const payment = paymentResult.rows[0];
        const userId = payment.user_id;
        // Actualizar el pago como completado
        await stripeService['db'].query(`
      UPDATE payments
      SET status = 'completed', 
          stripe_session_id = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [session_id, payment.id]);
        // Obtener el plan basado en el stripe_price_id
        const planName = await stripeService['getPlanNameFromPriceId'](payment.stripe_price_id);
        console.log(`📋 Plan detectado: ${planName}`);
        // Obtener el ID del plan desde la base de datos
        const planResult = await stripeService['db'].query(`
      SELECT id, name FROM plans WHERE name = $1
    `, [planName]);
        if (planResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: `Plan no encontrado: ${planName}`
            });
        }
        const planId = planResult.rows[0].id;
        // Actualizar plan del usuario
        await stripeService['db'].query(`
      UPDATE "user"
      SET plan_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [planId, userId]);
        console.log(`✅ Usuario ${userId} actualizado al plan ${planName} (ID: ${planId})`);
        res.json({
            success: true,
            message: 'Webhook simulado exitosamente',
            payment: {
                id: payment.id,
                status: 'completed',
                planName: planName,
                planId: planId
            }
        });
    }
    catch (error) {
        console.error('Error simulando webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Verificar configuración de webhook
router.get('/webhook-config', async (req, res) => {
    try {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        res.json({
            success: true,
            config: {
                hasWebhookSecret: !!webhookSecret,
                hasStripeKey: !!stripeKey,
                webhookSecretLength: webhookSecret ? webhookSecret.length : 0,
                stripeKeyLength: stripeKey ? stripeKey.length : 0
            }
        });
    }
    catch (error) {
        console.error('Error verificando configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error verificando configuración'
        });
    }
});
exports.default = router;
//# sourceMappingURL=stripeRoutes.js.map