const Stripe = require('stripe');
require('dotenv').config();

async function testStripeConnection() {
  try {
    console.log('🔍 Probando conexión con Stripe...');
    
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ Error: STRIPE_SECRET_KEY no está configurada en .env');
      return;
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil'
    });

    // Probar conexión obteniendo la cuenta
    const account = await stripe.accounts.retrieve();
    console.log('✅ Conexión exitosa con Stripe');
    console.log('📧 Email de la cuenta:', account.email);
    console.log('🌍 País:', account.country);

    // Listar productos
    console.log('\n📦 Productos disponibles:');
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price']
    });

    if (products.data.length === 0) {
      console.log('⚠️  No hay productos creados. Ejecuta: npm run stripe:setup');
    } else {
      products.data.forEach(product => {
        console.log(`- ${product.name}: ${product.id}`);
        if (product.default_price) {
          const price = product.default_price;
          console.log(`  Precio: ${price.unit_amount} ${price.currency}`);
        }
      });
    }

    // Listar precios
    console.log('\n💰 Precios disponibles:');
    const prices = await stripe.prices.list({
      active: true,
      expand: ['data.product']
    });

    prices.data.forEach(price => {
      const product = price.product;
      console.log(`- ${product.name}: ${price.id}`);
      console.log(`  Monto: ${price.unit_amount} ${price.currency}`);
      console.log(`  Recurrencia: ${price.recurring?.interval || 'one-time'}`);
    });

  } catch (error) {
    console.error('❌ Error conectando con Stripe:', error.message);
    
    if (error.message.includes('Invalid API key')) {
      console.log('\n💡 Solución: Verifica que tu STRIPE_SECRET_KEY sea correcta');
      console.log('   Debe empezar con: sk_test_...');
    }
  }
}

testStripeConnection(); 