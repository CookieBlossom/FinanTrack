-- Independent tables
-- Users Table
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "card_types" CASCADE;
DROP TABLE IF EXISTS "cards" CASCADE;
DROP TABLE IF EXISTS "movements" CASCADE;
DROP TABLE IF EXISTS "projected_movements" CASCADE;
DROP TABLE IF EXISTS "subscriptions" CASCADE;
DROP TABLE IF EXISTS "movement_patterns" CASCADE;
DROP TABLE IF EXISTS "goals" CASCADE;
DROP TABLE IF EXISTS "budgets" CASCADE;
CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name_category VARCHAR(100) NOT NULL UNIQUE,
    keywords TEXT[], -- Keywords para categorización automática
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Insert default categories
INSERT INTO categories (name_category, keywords) VALUES
    ('Alimentación', ARRAY['comida', 'restaurant', 'supermercado', 'alimentos', 'mercado', 'verdulería', 'cafetería']),
    ('Transporte', ARRAY['gasolina', 'taxi', 'uber', 'metro', 'bus', 'colectivo', 'estacionamiento', 'peaje']),
    ('Vivienda', ARRAY['arriendo', 'alquiler', 'hipoteca', 'luz', 'agua', 'gas', 'internet', 'mantenimiento']),
    ('Salud', ARRAY['médico', 'farmacia', 'medicamentos', 'consulta', 'hospital', 'clínica', 'dental']),
    ('Entretenimiento', ARRAY['cine', 'teatro', 'concierto', 'streaming', 'juegos', 'spotify', 'netflix']),
    ('Compras', ARRAY['ropa', 'calzado', 'tecnología', 'accesorios', 'muebles', 'electrodomésticos']),
    ('Otros', ARRAY['varios', 'otros', 'misceláneo'])
ON CONFLICT (name_category) DO NOTHING;

-- Card Types Table
CREATE TABLE card_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Insert default card types
INSERT INTO card_types (name) VALUES
    ('Débito'),
    ('Crédito'),
    ('Efectivo'),
    ('Ahorro'),
    ('Inversiones'),
    ('Otros')
ON CONFLICT (name) DO NOTHING;

-- Dependent tables
-- Cards Table
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    name_account VARCHAR(100) NOT NULL,
    card_type_id INTEGER REFERENCES card_types(id),
    balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    alias_account VARCHAR(100),
    currency VARCHAR(3) NOT NULL DEFAULT 'CLP',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status_account VARCHAR(50) NOT NULL DEFAULT 'active',
    updated_at TIMESTAMP
);

-- Movements Table
CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    movement_type VARCHAR(50) NOT NULL, -- income, expense
    movement_source VARCHAR(50) NOT NULL, -- manual, scrapper, subscription, projected
    transaction_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    metadata JSONB -- Para almacenar datos adicionales del scrapper
);

-- Projected Movements Table
CREATE TABLE IF NOT EXISTS projected_movements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    card_id INTEGER REFERENCES cards(id),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    movement_type VARCHAR(50) NOT NULL, -- income, expense
    expected_date DATE,
    probability INTEGER DEFAULT 100, -- Porcentaje de probabilidad de que ocurra
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
    actual_movement_id INTEGER REFERENCES movements(id), -- Se llena cuando el movimiento se realiza
    recurrence_type VARCHAR(50), -- null para único, monthly, yearly, weekly para recurrentes
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    billing_period VARCHAR(50) NOT NULL, -- monthly, yearly, weekly
    next_billing_date DATE NOT NULL,
    payment_method INTEGER REFERENCES cards(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, paused, cancelled
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Movement Patterns Table
CREATE TABLE IF NOT EXISTS movement_patterns (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id),
    pattern_text TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,
    UNIQUE(pattern_text)
);

-- Goals Table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    amount_expected DECIMAL(12,2) NOT NULL,
    amount_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
    goal_period VARCHAR(50) NOT NULL, -- monthly, yearly, weekly
    deadline DATE NOT NULL,
    goal_description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    amount_limit DECIMAL(12,2) NOT NULL,
    period VARCHAR(50) NOT NULL, -- monthly, yearly, weekly
    start_date DATE NOT NULL,
    end_date DATE,
    alert_threshold INTEGER, -- Porcentaje para alertar cuando se acerca al límite
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Índices para optimización de consultas
-- Users: búsqueda por email (login)
CREATE INDEX idx_users_email ON "user"(email);
-- Crear índices
CREATE INDEX idx_user_role ON "user"(role);
CREATE INDEX idx_user_is_active ON "user"(is_active);
-- Categories: búsqueda por nombre
CREATE INDEX idx_categories_name ON categories(name_category);

-- Cards: búsqueda por usuario y estado
CREATE INDEX idx_cards_user ON cards(user_id, status_account);
CREATE INDEX idx_cards_type ON cards(card_type_id);

-- Movements: índices para reportes y búsquedas frecuentes
CREATE INDEX idx_movements_user_date ON movements(card_id, transaction_date);
CREATE INDEX idx_movements_category ON movements(category_id);
CREATE INDEX idx_movements_type_date ON movements(movement_type, transaction_date);
CREATE INDEX idx_movements_source ON movements(movement_source);

-- Projected Movements: búsqueda por fecha y estado
CREATE INDEX idx_projected_date ON projected_movements(expected_date);
CREATE INDEX idx_projected_user_status ON projected_movements(user_id, status);
CREATE INDEX idx_projected_category ON projected_movements(category_id);

-- Subscriptions: búsqueda por usuario y estado
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_next_billing ON subscriptions(next_billing_date);

-- Movement Patterns: búsqueda por categoría
CREATE INDEX idx_patterns_category ON movement_patterns(category_id);

-- Goals: búsqueda por usuario y fecha límite
CREATE INDEX idx_goals_user ON goals(user_id, deadline);
CREATE INDEX idx_goals_category ON goals(category_id);

-- Índices para búsqueda en texto completo
CREATE INDEX idx_movements_description_gin ON movements USING gin(to_tsvector('spanish', description));
CREATE INDEX idx_patterns_text_gin ON movement_patterns USING gin(to_tsvector('spanish', pattern_text));

-- Índice para búsqueda en JSONB
CREATE INDEX idx_movements_metadata ON movements USING gin(metadata); 