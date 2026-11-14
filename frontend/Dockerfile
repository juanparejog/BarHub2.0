FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration=production

FROM caddy:2-alpine
COPY --from=builder /app/dist/barhub/. /usr/share/caddy/
COPY Caddyfile /etc/caddy/Caddyfile

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80