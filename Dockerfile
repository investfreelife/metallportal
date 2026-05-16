# Dockerfile для Yandex Cloud Serverless Container deployment.
# ТЗ #047 — strangler-fig migration (Vercel + YC parallel).
# Standalone build per next.config.js `output: 'standalone'`.

# ---------- Stage 1: dependencies ----------
FROM node:20-alpine AS deps
WORKDIR /app
# Use ci для voспроизводимого builda — нужны и dev deps для build phase
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --no-fund

# ---------- Stage 2: build ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public env vars (baked в client bundle)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MARKETPLACE_CUTOVER
ARG NEXT_PUBLIC_USE_YANDEX_CDN
ARG NEXT_PUBLIC_IMAGE_CDN_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
# ТЗ #050 — Metrika counter ID baked at build time (Next.js NEXT_PUBLIC_ semantics)
ARG NEXT_PUBLIC_YANDEX_METRIKA_ID

# Build-time server secrets (нужны для Next.js collect page data — API routes
# import top-level Supabase admin client). Multi-stage: эти ARG/ENV existуют
# только в stage 2 (builder) и discarded — final image (stage 3) их не содержит.
# Runtime сервер ENV'ы будут передаваться через YC Container Solution config.
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SUPABASE_ACCESS_TOKEN
ARG TURNSTILE_SECRET_KEY
ARG RESEND_API_KEY
ARG VOXIMPLANT_SERVICE_ACCOUNT_BASE64
ARG REVALIDATE_SECRET

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_MARKETPLACE_CUTOVER=$NEXT_PUBLIC_MARKETPLACE_CUTOVER
ENV NEXT_PUBLIC_USE_YANDEX_CDN=$NEXT_PUBLIC_USE_YANDEX_CDN
ENV NEXT_PUBLIC_IMAGE_CDN_URL=$NEXT_PUBLIC_IMAGE_CDN_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_YANDEX_METRIKA_ID=$NEXT_PUBLIC_YANDEX_METRIKA_ID
# Builder-only (discarded в final image)
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN
ENV TURNSTILE_SECRET_KEY=$TURNSTILE_SECRET_KEY
ENV RESEND_API_KEY=$RESEND_API_KEY
ENV VOXIMPLANT_SERVICE_ACCOUNT_BASE64=$VOXIMPLANT_SERVICE_ACCOUNT_BASE64
ENV REVALIDATE_SECRET=$REVALIDATE_SECRET

RUN npm run build

# ---------- Stage 3: runner ----------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# YC Serverless Containers expects port 8080 (reserved/non-overridable per docs).
# Next.js standalone reads PORT env to bind. Cannot pass PORT via --environment
# на revision-deploy (YC rejects "Environment variable PORT is forbidden").
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# ТЗ #047 ADDENDUM 3: install sharp для Next.js Image Optimization
# (AVIF/WebP/resize). Без sharp /_next/image работает в passthrough mode —
# все размеры возвращают одинаковый файл, нет format conversion. Page weight
# на L3 catalog становится 3.2 MB вместо 250 KB. Sharp на Alpine (musl) требует
# platform=linuxmusl flag + libvips system package.
RUN apk add --no-cache vips
RUN npm install -g sharp@latest --platform=linuxmusl --arch=x64 --libc=musl
ENV NEXT_SHARP_PATH=/usr/local/lib/node_modules/sharp

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output — все runtime files в .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
