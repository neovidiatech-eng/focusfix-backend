#!/bin/sh
set -e

echo "==> [FocusFix API] Starting container initialization..."

# 1. Execute database migrations
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "==> [Database] Checking and applying migrations..."
  npx prisma migrate deploy || npx prisma db push --skip-generate
  echo "==> [Database] Migrations applied successfully."
fi

# 2. Execute database seeding if requested
if [ "$SEED_DATABASE" = "true" ]; then
  echo "==> [Database] Running initial database seed..."
  npm run seed || echo "==> [Database] Seeding completed or skipped."
fi

echo "==> [FocusFix API] Launching application server..."
# 3. Execute the container's main command
exec "$@"
