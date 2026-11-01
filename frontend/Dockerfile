FROM caddy:2-alpine

COPY dist/ /usr/share/caddy/

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80 443