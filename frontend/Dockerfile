# Frontend/Dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration=production

FROM caddy:2-alpine
COPY --from=builder /app/dist/BarHub /srv
COPY Caddyfile /etc/caddy/Caddyfile