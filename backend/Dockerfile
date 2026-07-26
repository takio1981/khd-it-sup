# =====================================================================================
# KHD-IT-SUP Backend — Multi-stage Dockerfile (Node.js 20 LTS)
# =====================================================================================

# ---- Stage 1: deps (ติดตั้ง dependency ทั้งหมดรวม devDependencies สำหรับ build) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Stage 2: build (compile TypeScript -> JS, generate Prisma Client) ----
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: production deps only (ไม่มี devDependencies เพื่อลดขนาด image) ----
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ---- Stage 4: runtime (image สุดท้ายที่ deploy จริง) ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache dumb-init openssl && addgroup -S nodejs && adduser -S khd -G nodejs
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=khd:nodejs --from=prod-deps /app/node_modules ./node_modules
COPY --chown=khd:nodejs --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=khd:nodejs --from=build /app/dist ./dist
COPY --chown=khd:nodejs --from=build /app/prisma ./prisma
COPY --chown=khd:nodejs package.json ./

RUN mkdir -p uploads logs && chown -R khd:nodejs uploads logs

USER khd
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
