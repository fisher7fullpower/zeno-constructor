#!/bin/bash
# ============================================================
# setup_supabase.sh
# Подключение Supabase к SMM Admin на сервере
# Запустить после создания проекта на supabase.com
#
# WARNING: Never pass secrets via CLI arguments — they leak into
# process listings and shell history. Set environment variables:
#   export SUPABASE_URL=https://abc123.supabase.co
#   export SUPABASE_ANON_KEY=eyJhbGc...
#   export SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
#   ./setup_supabase.sh
# ============================================================

set -e

SERVER="root@morrowlab.by"
APP_DIR="/opt/smm-admin"

# Read secrets from environment variables — never pass via CLI arguments
SUPABASE_URL="${SUPABASE_URL:?Set SUPABASE_URL env var}"
ANON_KEY="${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY env var}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY env var}"

echo "=== Обновление .env.local на сервере ==="

ssh -o StrictHostKeyChecking=no "$SERVER" "
sed -i 's|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL|' $APP_DIR/.env.local
sed -i 's|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|' $APP_DIR/.env.local
sed -i 's|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|' $APP_DIR/.env.local
echo 'Updated .env.local'
grep 'SUPABASE' $APP_DIR/.env.local | sed 's/=.*$/=***/'
"

echo ""
echo "=== Перезапуск SMM Admin ==="
ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 restart smm-admin && pm2 status"

echo ""
echo "=== Готово! ==="
echo "Проверь: http://smm.morrowlab.by"
echo ""
echo "Следующий шаг — выполни SQL схему в Supabase:"
echo "  → Supabase → SQL Editor → вставь содержимое supabase_schema.sql"
