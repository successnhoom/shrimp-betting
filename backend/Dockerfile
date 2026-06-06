FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --only=production

FROM base AS builder
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/index.js"]
