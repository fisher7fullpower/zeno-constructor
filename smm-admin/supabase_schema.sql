-- ============================================================
-- SMM Admin — Supabase Schema
-- Выполнить в Supabase → SQL Editor
-- ============================================================

-- Клиенты (рабочие пространства)
CREATE TABLE IF NOT EXISTS clients (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  owner_id        UUID REFERENCES auth.users(id),
  timezone        TEXT DEFAULT 'Europe/Minsk',
  brand_kit       JSONB DEFAULT '{}',
  schedule        JSONB DEFAULT '{}',
  require_approval BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Связь пользователей с клиентами + роли
CREATE TABLE IF NOT EXISTS client_users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT CHECK (role IN ('owner', 'client', 'operator')) DEFAULT 'client',
  UNIQUE(client_id, user_id)
);

-- Кэш публикаций
CREATE TABLE IF NOT EXISTS posts_cache (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           UUID REFERENCES clients(id) ON DELETE CASCADE,
  platform            TEXT[],
  status              TEXT,
  caption             TEXT,
  media_url           TEXT,
  scheduled_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ DEFAULT now()
);

-- Приглашения для клиентов
CREATE TABLE IF NOT EXISTS invites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  UUID REFERENCES clients(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role       TEXT DEFAULT 'client',
  used       BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- client_users: пользователь видит только свои записи
CREATE POLICY "client_users_select_own" ON client_users
  FOR SELECT USING (user_id = auth.uid());

-- clients: пользователь видит клиентов, к которым привязан
CREATE POLICY "clients_select_own" ON clients
  FOR SELECT USING (
    id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );

-- clients: только owner может создавать/изменять
CREATE POLICY "clients_insert_owner" ON clients
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "clients_update_owner" ON clients
  FOR UPDATE USING (
    id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'operator')
    )
  );

-- posts_cache: пользователь видит посты своих клиентов
CREATE POLICY "posts_cache_select" ON posts_cache
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())
  );

CREATE POLICY "posts_cache_insert" ON posts_cache
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'operator')
    )
  );

-- invites: owner видит свои приглашения
CREATE POLICY "invites_select" ON invites
  FOR SELECT USING (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ── Индексы ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_client_users_user_id ON client_users(user_id);
CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON client_users(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_cache_client_id ON posts_cache(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);
