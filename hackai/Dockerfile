# syntax=docker/dockerfile:1

# Imagen de HackAI en cuatro etapas. La final solo lleva el servidor
# standalone de Next.js, sin node_modules completos ni código fuente.
#   docker build -t hackai .                  # imagen para correr
#   docker build --target check -t hackai .   # typecheck y tests

ARG NODE_VERSION=22

# 1. deps: instala las dependencias desde el lockfile. Se cachea mientras no
#    cambien package.json ni package-lock.json.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# 2. check: typecheck y tests. No la usa la imagen final; se pide con --target.
FROM deps AS check
COPY . .
RUN npm run typecheck && npm test

# 3. builder: compila Next.js en modo standalone.
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

# 4. runner: solo lo necesario para servir, con un usuario sin privilegios.
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Usa el fetch de Node para no sumar curl ni wget a la imagen. Mientras
# arranca chequea cada 2 s (start-interval, Docker Engine 25 o más nuevo),
# así pasa a healthy enseguida; después, cada 30 s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --start-interval=2s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
