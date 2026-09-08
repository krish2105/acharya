#!/usr/bin/env bash
# Seeds a cloud Supabase database whose schema was applied via the MCP / dashboard.
# Reads SUPABASE_DB_URL from supabase/.cloud.env (git-ignored). Never prints it.
#   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f supabase/.cloud.env ] || { echo "supabase/.cloud.env not found (needs SUPABASE_DB_URL=...)"; exit 1; }
set -a; . supabase/.cloud.env; set +a
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL missing in supabase/.cloud.env}"
for f in supabase/seed/*.sql; do
  echo "seeding $(basename "$f")"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
psql "$SUPABASE_DB_URL" -At -c "select 'students='||(select count(*) from students)||' items='||(select count(*) from items)||' artifacts='||(select count(*) from artifacts)||' users='||(select count(*) from auth.users)||' snapshot='||(select count(*) from information_schema.tables where table_schema='demo_snapshot');"
