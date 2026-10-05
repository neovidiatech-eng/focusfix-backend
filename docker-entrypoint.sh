#!/bin/sh
set -e

echo "==> [FocusFix API] Starting container initialization..."

# 1. Execute database migrations
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "==> [Database] Checking and applying migrations/schema..."
  if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    npx prisma migrate deploy
  else
    npx prisma db push --skip-generate
  fi
  echo "==> [Database] Database schema synchronized successfully."
fi

# 2. Execute database seeding if requested
if [ "$SEED_DATABASE" = "true" ]; then
  echo "==> [Database] Running initial database seed..."
  npm run seed || echo "==> [Database] Seeding completed or skipped."
fi

echo "==> [FocusFix API] Launching application server..."
# 3. Execute the container's main command
exec "$@"
