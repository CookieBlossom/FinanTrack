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
    is_active BOOLEAN NOT NULL DEFAULT true,
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE "user" ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'free';
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
-- Categorías base del sistema
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name_category VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) DEFAULT 'ellipsis-h',
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

INSERT INTO categories (name_category, icon, color, is_system) VALUES
    ('Alimentacion', 'utensils', '#FF9800', true),
    ('Transporte', 'bus', '#9C27B0', true),
    ('Vivienda', 'house', '#607D8B', true),
    ('Salud', 'heart-pulse', '#F44336', true),
    ('Entretenimiento', 'film', '#2196F3', true),
    ('Compras', 'shopping-cart', '#4CAF50', true),
    ('Educacion', 'graduation-cap', '#3F51B5', true),
    ('Otros', 'ellipsis', '#9E9E9E', true)
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
    balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    alias_account VARCHAR(100),
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
    status_account VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);
ALTER TABLE cards
ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual';

ALTER TABLE cards
ADD CONSTRAINT cards_source_check
CHECK (source IN ('manual', 'scraper', 'imported', 'api'));

ALTER TABLE cards
ADD COLUMN bank_id INTEGER REFERENCES banks(id);
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
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending', -- completed, failed, refunded
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP, -- si es suscripción o tiene fecha de expiración
    description TEXT
);
-- Índices para optimización
CREATE INDEX idx_users_email ON "user"(email);
CREATE INDEX idx_user_role ON "user"(role);
CREATE INDEX idx_user_is_active ON "user"(is_active);
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