# ==========================================
# 1. Base Stage
# ==========================================
FROM node:20-alpine AS base

# Install openssl and libc6-compat for Prisma & native bindings
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# ==========================================
# 2. Dependencies Stage
# ==========================================
FROM base AS dependencies

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build & types)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# ==========================================
# 3. Builder Stage
# ==========================================
FROM base AS builder

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/prisma ./prisma
COPY package*.json tsconfig.json ./
COPY src ./src

# Build TypeScript to dist
RUN npm run build

# ==========================================
# 4. Production Runner Stage
# ==========================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Create application user for security
USER node

# Copy package manifests
COPY --chown=node:node package*.json ./

# Copy dependencies and built code
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=dependencies /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/dist ./dist

# Copy entrypoint script
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh 2>/dev/null || true

EXPOSE 4000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
