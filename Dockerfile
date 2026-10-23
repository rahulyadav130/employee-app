# ---- Stage 1: install production dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci = clean, reproducible install from the lock file
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: runtime image (small, non-root) ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Copy only what the app needs (see .dockerignore)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public

# Don't run as root. The node image ships a 'node' user (uid 1000).
USER node

EXPOSE 3000

# Exec form so Node receives SIGTERM directly (needed for graceful shutdown)
CMD ["node", "src/server.js"]
# comment 1

# comment 1
# comment 2