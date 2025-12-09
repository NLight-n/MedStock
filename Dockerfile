# ───────────────────────────────────────────────
# 1. Install dependencies only when needed
# ───────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

# Install needed OS-level build deps for node modules
RUN apt-get update && apt-get install -y \
  openssl \
  python3 \
  build-essential \
  pkg-config \
  && apt-get clean

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile



# ───────────────────────────────────────────────
# 2. Build the application
# ───────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Ensure correct Prisma engine is downloaded
RUN npm install prisma @prisma/client

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build



# ───────────────────────────────────────────────
# 3. Create Production Image
# ───────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
  dumb-init \
  postgresql-client \
  && apt-get clean

# Create non-root user
RUN groupadd -g 1001 nodejs \
  && useradd -m -u 1001 -g nodejs nextjs

COPY --from=builder /app ./

USER nextjs
EXPOSE 3000

# Run DB migration + start server
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && npm start"]
