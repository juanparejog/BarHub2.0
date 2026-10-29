FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration=production

FROM caddy:2-alpine

RUN addgroup -g 1000 caddy-group && \
    adduser -D -u 1000 -G caddy-group caddy-user

COPY --from=builder --chown=caddy-user:caddy-group /app/dist/ /usr/share/caddy/

USER caddy-user

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80 443