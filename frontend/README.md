# BarHub: frontend

Aplicación Angular 22 de BarHub. La documentación completa está en [docs/frontend.md](../docs/frontend.md).

## Comandos

```bash
npm ci --legacy-peer-deps                 # instalar dependencias (igual que el CI y Docker)
npm start                                 # servidor de desarrollo en http://localhost:4200
npm run build -- --configuration=production   # build de producción en dist/barhub/browser
npm test                                  # tests unitarios
```

Para levantar la aplicación completa (frontend, backend, base de datos y Caddy) se usa Docker Compose desde `infra/docker`; ver el [README principal](../README.md).
