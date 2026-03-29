-- ============================================================
-- SMM Admin — PostgreSQL schema (без Supabase auth.users)
-- Выполнить: psql -U smm_user -d smm_admin -f pg_schema.sql
-- ============================================================

-- Пользователи (заменяет Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'client' NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Клиенты (рабочие пространства)
CREATE TABLE IF NOT EXISTS clients (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  owner_id              UUID REFERENCES users(id),
  timezone              TEXT DEFAULT 'Europe/Minsk',
  brand_kit             JSONB DEFAULT '{}',
  schedule              JSONB DEFAULT '{}',
  require_approval      BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Связь пользователей с клиентами + роли
CREATE TABLE IF NOT EXISTS client_users (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT CHECK (role IN ('owner', 'client', 'operator')) DEFAULT 'client',
  UNIQUE (client_id, user_id)
);

-- Кэш публикаций
CREATE TABLE IF NOT EXISTS posts_cache (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         UUID REFERENCES clients(id) ON DELETE CASCADE,
  platform          TEXT[],
  status            TEXT,
  caption           TEXT,
  media_url         TEXT,
  scheduled_at      TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ DEFAULT now()
);

-- Приглашения
CREATE TABLE IF NOT EXISTS invites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role       TEXT DEFAULT 'client',
  used       BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);

-- Magic tokens for passwordless auth
CREATE TABLE IF NOT EXISTS magic_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  purpose TEXT DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Licensed emails for access control
CREATE TABLE IF NOT EXISTS licensed_emails (
  email TEXT PRIMARY KEY,
  plan TEXT,
  licensed BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Индексы ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_client_users_user_id   ON client_users(user_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_cache_client_id  ON posts_cache(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_slug           ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_owner          ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_invites_token          ON invites(token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_token     ON magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_email     ON magic_tokens(email);
