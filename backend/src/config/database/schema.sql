-- Eliminar tablas existentes
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "card_types" CASCADE;
DROP TABLE IF EXISTS "cards" CASCADE;
DROP TABLE IF EXISTS "movements" CASCADE;
DROP TABLE IF EXISTS "projected_movements" CASCADE;
DROP TABLE IF EXISTS "movement_patterns" CASCADE;
DROP TABLE IF EXISTS "user_category_keywords" CASCADE;
DROP TABLE IF EXISTS "statements" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;
DROP TABLE IF EXISTS "plan_limits" CASCADE;
DROP TABLE IF EXISTS "plan_permissions" CASCADE;
DROP TABLE IF EXISTS "plans" CASCADE;
DROP TABLE IF EXISTS "banks" CASCADE;

CREATE TABLE banks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO banks (name) VALUES
  ('BancoEstado'),
  ('Banco de Chile'),
  ('Banco Santander'),
  ('Banco BCI'),
  ('Banco Itaú'),
  ('Banco Scotiabank'),
  ('Banco Falabella'),
  ('Banco Ripley'),
  ('Banco Security'),
  ('Banco Consorcio'),
  ('Banco Internacional'),
  ('Banco BICE'),
  ('Banco BTG Pactual'),
  ('Banco del Desarrollo (fusionado con Scotiabank)'),
  ('HSBC Bank (Chile)'),
  ('Banco Do Brasil (Sucursal Chile)'),
  ('Otros');

-- 1. Crear tabla de planes primero
CREATE TABLE plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  stripe_price_id VARCHAR(100),
  monthly_price DECIMAL(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Insertar los tres planes con nombres actualizados
INSERT INTO plans (name, description, stripe_price_id, monthly_price) VALUES
  ('basic', 'Plan básico: hasta 100 movimientos por importación, 2 tarjetas, 5 palabras clave por categoría', 'price_1RcdNcIJmAE0NFjMRh0sZk3V', 0.00),
  ('premium', 'Plan premium: hasta 1000 movimientos por importación, 10 tarjetas, 10 palabras clave, cartolas bancarias', 'price_1RcdQLIJmAE0NFjM3hX6ia7w', 10000.00),
  ('pro', 'Plan pro: movimientos ilimitados, tarjetas ilimitadas, scraper automático, categorización automatizada', 'price_1RcdR5IJmAE0NFjMiO5Sa052', 25000.00);

-- Tabla de usuarios
CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    country_code VARCHAR(5) DEFAULT '+56',
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    plan_id INTEGER REFERENCES plans(id) NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
-- Categorías base del sistema
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name_category VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#9E9E9E',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Palabras clave por usuario para categorías
CREATE TABLE user_category_keywords (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    keywords TEXT[] DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, category_id)
);

INSERT INTO categories (name_category, color, is_system) VALUES
    ('Alimentacion', '#FF9800', true),
    ('Transporte', '#9C27B0', true),
    ('Vivienda', '#607D8B', true),
    ('Salud', '#F44336', true),
    ('Entretenimiento', '#2196F3', true),
    ('Compras', '#4CAF50', true),
    ('Educacion', '#3F51B5', true),
    ('Otros', '#9E9E9E', true)
ON CONFLICT (name_category) DO NOTHING;

-- Tipos de tarjetas
CREATE TABLE card_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Tipos de tarjeta por defecto
INSERT INTO card_types (name) VALUES
    ('Debito'), ('Credito'), ('Credito Comercial'), ('Prepago'), ('Efectivo'), ('Ahorro'), 
    ('Inversiones'), ('Cuenta Rut'), ('Otros')
ON CONFLICT (name) DO NOTHING;

-- Tarjetas
CREATE TABLE cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    name_account VARCHAR(100) NOT NULL,
    card_type_id INTEGER REFERENCES card_types(id),
    bank_id INTEGER REFERENCES banks(id),
    balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    alias_account VARCHAR(100),
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
    status_account VARCHAR(50) NOT NULL DEFAULT 'active',
    source VARCHAR(20) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    CONSTRAINT cards_source_check CHECK (source IN ('manual', 'scraper', 'imported', 'api'))
);

-- Movimientos (incluye ingresos, egresos, cartolas, etc.)
CREATE TABLE movements (
    id SERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    movement_type VARCHAR(10) NOT NULL, -- 'income' | 'expense'
    movement_source VARCHAR(20) NOT NULL, -- 'manual', 'scraper', 'subscription', 'projected', 'cartola'
    transaction_date TIMESTAMP NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Movimientos proyectados (pueden ser únicos o recurrentes)
CREATE TABLE projected_movements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    card_id INTEGER REFERENCES cards(id),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    movement_type VARCHAR(50) NOT NULL, -- income, expense
    expected_date DATE,
    probability INTEGER DEFAULT 100,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
    actual_movement_id INTEGER REFERENCES movements(id),
    recurrence_type VARCHAR(50), -- null, monthly, yearly, weekly
    is_recurrent BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Patrones de texto para categorización automática
CREATE TABLE movement_patterns (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    pattern_text TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    UNIQUE(pattern_text)
);

-- Cartolas procesadas
CREATE TABLE statements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
    file_hash VARCHAR(64) NOT NULL UNIQUE,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'stripe',
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded, cancelled
    stripe_session_id VARCHAR(255), -- ID de la sesión de Stripe
    stripe_payment_intent_id VARCHAR(255), -- ID del payment intent de Stripe
    stripe_subscription_id VARCHAR(255), -- ID de la suscripción de Stripe
    stripe_price_id VARCHAR(255), -- ID del precio de Stripe
    currency VARCHAR(3) DEFAULT 'CLP',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- si es suscripción o tiene fecha de expiración
    description TEXT,
    metadata JSONB -- Para almacenar datos adicionales de Stripe
);

-- 3. Crear tabla de límites numéricos por plan
CREATE TABLE plan_limits (
  plan_id   INTEGER REFERENCES plans(id) ON DELETE CASCADE,
  limit_key VARCHAR(50) NOT NULL,   -- p.ej. 'manual_movements', 'cartola_movements', 'scraper_movements', 'max_cards', 'keywords_per_category'
  limit_val INTEGER NOT NULL,       -- usar -1 para ilimitado
  PRIMARY KEY(plan_id, limit_key)
);

-- 4. Crear tabla de permisos/flags booleanos por plan
CREATE TABLE plan_permissions (
  plan_id       INTEGER REFERENCES plans(id) ON DELETE CASCADE,
  permission_key VARCHAR(50) NOT NULL,  -- p.ej. 'manual_movements', 'cartola_upload', 'scraper_access', 'automated_categorization'
  PRIMARY KEY(plan_id, permission_key)
);

-- 5. Rellenar límites para cada plan (por tipo de fuente)
-- Plan Básico
INSERT INTO plan_limits (plan_id, limit_key, limit_val) VALUES
  ((SELECT id FROM plans WHERE name='basic'), 'manual_movements', 100),
  ((SELECT id FROM plans WHERE name='basic'), 'cartola_movements', 0),
  ((SELECT id FROM plans WHERE name='basic'), 'scraper_movements', 0),
  ((SELECT id FROM plans WHERE name='basic'), 'max_cards', 2),
  ((SELECT id FROM plans WHERE name='basic'), 'keywords_per_category', 5),
  ((SELECT id FROM plans WHERE name='basic'), 'monthly_cartolas', 0),
  ((SELECT id FROM plans WHERE name='basic'), 'monthly_scrapes', 0);

-- Plan Premium
INSERT INTO plan_limits (plan_id, limit_key, limit_val) VALUES
  ((SELECT id FROM plans WHERE name='premium'), 'manual_movements', 1000),
  ((SELECT id FROM plans WHERE name='premium'), 'cartola_movements', -1), -- Ilimitado
  ((SELECT id FROM plans WHERE name='premium'), 'scraper_movements', 0),
  ((SELECT id FROM plans WHERE name='premium'), 'max_cards', 10),
  ((SELECT id FROM plans WHERE name='premium'), 'keywords_per_category', 10),
  ((SELECT id FROM plans WHERE name='premium'), 'monthly_cartolas', -1), -- Ilimitado
  ((SELECT id FROM plans WHERE name='premium'), 'monthly_scrapes', 0);

-- Plan Pro (Ilimitado = -1)
INSERT INTO plan_limits (plan_id, limit_key, limit_val) VALUES
  ((SELECT id FROM plans WHERE name='pro'), 'manual_movements', -1),
  ((SELECT id FROM plans WHERE name='pro'), 'cartola_movements', -1),
  ((SELECT id FROM plans WHERE name='pro'), 'scraper_movements', -1),
  ((SELECT id FROM plans WHERE name='pro'), 'max_cards', -1),
  ((SELECT id FROM plans WHERE name='pro'), 'keywords_per_category', -1),
  ((SELECT id FROM plans WHERE name='pro'), 'monthly_cartolas', -1),
  ((SELECT id FROM plans WHERE name='pro'), 'monthly_scrapes', -1);

-- 6. Rellenar permisos para cada plan
-- Plan Básico
INSERT INTO plan_permissions (plan_id, permission_key) VALUES
  ((SELECT id FROM plans WHERE name='basic'), 'manual_movements'),
  ((SELECT id FROM plans WHERE name='basic'), 'manual_cards'),
  ((SELECT id FROM plans WHERE name='basic'), 'basic_categorization'),
  ((SELECT id FROM plans WHERE name='basic'), 'email_support');

-- Plan Premium
INSERT INTO plan_permissions (plan_id, permission_key) VALUES
  ((SELECT id FROM plans WHERE name='premium'), 'manual_movements'),
  ((SELECT id FROM plans WHERE name='premium'), 'manual_cards'),
  ((SELECT id FROM plans WHERE name='premium'), 'advanced_categorization'),
  ((SELECT id FROM plans WHERE name='premium'), 'priority_support'),
  ((SELECT id FROM plans WHERE name='premium'), 'cartola_upload'),
  ((SELECT id FROM plans WHERE name='premium'), 'export_data');

-- Plan Pro
INSERT INTO plan_permissions (plan_id, permission_key) VALUES
  ((SELECT id FROM plans WHERE name='pro'), 'manual_movements'),
  ((SELECT id FROM plans WHERE name='pro'), 'manual_cards'),
  ((SELECT id FROM plans WHERE name='pro'), 'advanced_categorization'),
  ((SELECT id FROM plans WHERE name='pro'), 'priority_support'),
  ((SELECT id FROM plans WHERE name='pro'), 'cartola_upload'),
  ((SELECT id FROM plans WHERE name='pro'), 'scraper_access'),
  ((SELECT id FROM plans WHERE name='pro'), 'automated_categorization'),
  ((SELECT id FROM plans WHERE name='pro'), 'export_data'),
  ((SELECT id FROM plans WHERE name='pro'), 'api_access'),
  ((SELECT id FROM plans WHERE name='pro'), 'executive_dashboard');

-- Índices para optimización
CREATE INDEX idx_users_email ON "user"(email);
CREATE INDEX idx_user_role ON "user"(role);
CREATE INDEX idx_user_is_active ON "user"(is_active);
CREATE INDEX idx_user_plan ON "user"(plan_id);
CREATE INDEX idx_categories_name ON categories(name_category);
CREATE INDEX idx_cards_user ON cards(user_id, status_account);
CREATE INDEX idx_cards_type ON cards(card_type_id);
CREATE INDEX idx_movements_user_date ON movements(card_id, transaction_date);
CREATE INDEX idx_movements_category ON movements(category_id);
CREATE INDEX idx_movements_type_date ON movements(movement_type, transaction_date);
CREATE INDEX idx_movements_source ON movements(movement_source);
CREATE INDEX idx_projected_date ON projected_movements(expected_date);
CREATE INDEX idx_projected_user_status ON projected_movements(user_id, status);
CREATE INDEX idx_projected_category ON projected_movements(category_id);
CREATE INDEX idx_patterns_category ON movement_patterns(category_id);
CREATE INDEX idx_user_category_keywords_user ON user_category_keywords(user_id);
CREATE INDEX idx_user_category_keywords_category ON user_category_keywords(category_id);
CREATE INDEX idx_movements_description_gin ON movements USING gin(to_tsvector('spanish', description));
CREATE INDEX idx_patterns_text_gin ON movement_patterns USING gin(to_tsvector('spanish', pattern_text));
CREATE INDEX idx_movements_metadata ON movements USING gin(metadata);
CREATE UNIQUE INDEX unique_card_per_user ON cards(user_id, name_account, card_type_id, bank_id);
CREATE INDEX idx_plan_limits_plan_key ON plan_limits(plan_id, limit_key);
CREATE INDEX idx_plan_permissions_plan_key ON plan_permissions(plan_id, permission_key);