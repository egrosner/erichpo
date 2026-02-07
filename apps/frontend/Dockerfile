FROM node:24-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/frontend/ apps/frontend/
COPY packages/shared/ packages/shared/

# Build args for Vite (baked into bundle at build time)
ARG VITE_GITHUB_APP_URL
ENV VITE_GITHUB_APP_URL=$VITE_GITHUB_APP_URL

# Build
RUN pnpm --filter frontend build

# --- Production stage ---
FROM nginx:alpine AS production

COPY --from=base /app/apps/frontend/dist /usr/share/nginx/html

# SPA routing: serve index.html for all routes
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location /assets/ { \
        add_header Cache-Control "public, max-age=31536000, immutable"; \
    } \
    location / { \
        add_header Cache-Control "no-cache"; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
