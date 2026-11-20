FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts
COPY . .
RUN npm run build -- --configuration=production

FROM caddy:2-alpine
COPY --from=builder /app/dist/barhub/. /usr/share/caddy/
COPY Caddyfile /etc/caddy/Caddyfile

RUN addgroup -S barhub && adduser -S barhub -G barhub \
 && chown -R barhub:barhub /config /data /usr/share/caddy
USER barhub

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80