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

# Install OpenSSL for Prisma engine detection/build
RUN apt-get update && apt-get install -y \
  openssl \
  && apt-get clean

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
# Add PostgreSQL official APT repository for PostgreSQL 17 client
RUN apt-get update && apt-get install -y \
  dumb-init \
  wget \
  ca-certificates \
  gnupg \
  lsb-release \
  && mkdir -p /etc/apt/keyrings \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y \
  postgresql-client-17 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs \
  && useradd -m -u 1001 -g nodejs nextjs

COPY --from=builder /app ./

USER nextjs
EXPOSE 3000

# Run DB migration + start server
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && npm start"]
