FROM node:24-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/backend/ apps/backend/

# Generate Prisma client
RUN cd apps/backend && npx prisma generate

# Build
RUN pnpm --filter backend build

# --- Production stage ---
FROM node:24-slim AS production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile

# Copy built output, Prisma schema, and config
COPY --from=base /app/apps/backend/dist apps/backend/dist
COPY --from=base /app/apps/backend/prisma apps/backend/prisma
COPY --from=base /app/apps/backend/prisma.config.ts apps/backend/prisma.config.ts

# Generate Prisma client in production node_modules
RUN cd apps/backend && npx prisma generate

WORKDIR /app/apps/backend

EXPOSE 4847

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
