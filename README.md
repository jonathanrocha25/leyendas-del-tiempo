# Leyendas del Tiempo

Proyecto base para el evento de reconocimientos (Cencosud).

## Estructura
- `public/` estáticos (sube tu logo en `public/brand/logo-cencosud.webp` y las fotos en `public/images/`).
- `src/data.json` base de datos (un registro de ejemplo incluido).
- `api/` endpoints serverless para Vercel: `/empleado/:cedula` y `/api/qr`.
- `public/csv-converter.html` conversor CSV→JSON en navegador.

## Desarrollo local
```bash
npm install
npx vercel dev
# abrir http://localhost:3000
```

## Deploy
Conecta el repo en Vercel y asigna el dominio `leyendas-del-tiempo.vercel.app`.
