# Install dependencies only when needed
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

# Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npm install prisma@6.9.0 @prisma/client@6.9.0
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Install tini for better PID 1 handling (optional but recommended)
RUN apk add --no-cache dumb-init

# Install PostgreSQL client tools for backup/restore
RUN apk add --no-cache postgresql-client

# Security best practices
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy only the necessary files for production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/next-env.d.ts ./next-env.d.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder /app/tailwind.config.js ./tailwind.config.js
COPY --from=builder /app/prisma ./prisma

# If you use .env files, copy them as well
COPY --from=builder /app/.env ./.env

USER nextjs
EXPOSE 3000

# Run migrations and start the app
CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && npm start"]
