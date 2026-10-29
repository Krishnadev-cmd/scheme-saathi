# syntax=docker/dockerfile:1
# Production image. Build:  docker build -t scheme-saathi .
# Run:    docker run -d --env-file .env -p 3000:3000 -v saathi-data:/app/data scheme-saathi

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the site at build time.
ARG NEXT_PUBLIC_WHATSAPP_NUMBER=""
ARG NEXT_PUBLIC_TELEGRAM_BOT=""
ENV NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER NEXT_PUBLIC_TELEGRAM_BOT=$NEXT_PUBLIC_TELEGRAM_BOT
RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production APP_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/app/data/scheme-saathi.db
RUN groupadd --system app && useradd --system --gid app app \
 && mkdir -p /app/data && chown app:app /app/data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
