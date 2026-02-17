#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${PGDATABASE:-shireland}"
DB_USER="${PGUSER:-shireland}"
DB_PASSWORD="${PGPASSWORD:-shireland}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../apps/server/.env"

echo "=== Shireland Database Setup ==="
echo "  Host:     $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User:     $DB_USER"
echo ""

# Check that psql is available
if ! command -v psql &> /dev/null; then
  echo "Error: psql not found. Install PostgreSQL first:"
  echo "  brew install postgresql@16"
  exit 1
fi

# Check that the PostgreSQL server is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" &> /dev/null; then
  echo "Error: PostgreSQL is not running on $DB_HOST:$DB_PORT"
  echo "  brew services start postgresql@16"
  exit 1
fi

# Create role + database in a single idempotent SQL block
psql -h "$DB_HOST" -p "$DB_PORT" -v ON_ERROR_STOP=1 postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
    RAISE NOTICE 'Created role ${DB_USER}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
    RAISE NOTICE 'Role ${DB_USER} already exists — ensured password is current';
  END IF;
END
\$\$;
SQL

if ! psql -h "$DB_HOST" -p "$DB_PORT" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" postgres | grep -q 1; then
  psql -h "$DB_HOST" -p "$DB_PORT" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" postgres
  echo "Created database '$DB_NAME'"
else
  psql -h "$DB_HOST" -p "$DB_PORT" -v ON_ERROR_STOP=1 -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;" postgres
  echo "Database '$DB_NAME' already exists — ensured ownership"
fi

psql -h "$DB_HOST" -p "$DB_PORT" -v ON_ERROR_STOP=1 -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" postgres
echo "Privileges granted."

# Ensure .env has the PG vars (idempotent — updates existing or appends missing)
ensure_env_var() {
  local key="$1" val="$2"
  if [ -f "$ENV_FILE" ] && grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

ensure_env_var "PGUSER" "$DB_USER"
ensure_env_var "PGPASSWORD" "$DB_PASSWORD"
ensure_env_var "PGDATABASE" "$DB_NAME"
echo "Updated $ENV_FILE"

echo ""
echo "Done! Start the server — migrations run automatically:"
echo "  pnpm dev"
