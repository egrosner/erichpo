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

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile --prod

# Copy built output and Prisma files
COPY --from=base /app/apps/backend/dist apps/backend/dist
COPY --from=base /app/apps/backend/prisma apps/backend/prisma
COPY --from=base /app/apps/backend/node_modules/.prisma apps/backend/node_modules/.prisma
COPY --from=base /app/apps/backend/node_modules/@prisma apps/backend/node_modules/@prisma

# Run migrations and start
WORKDIR /app/apps/backend

EXPOSE 4847

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
