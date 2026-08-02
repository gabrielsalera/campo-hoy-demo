# Campo Hoy · Demo comercial

Aplicación React multipantalla para recorrer una operación agropecuaria completa con datos ficticios determinísticos. Funciona sin credenciales y guarda las cargas en IndexedDB.

## Ejecutar

```bash
npm install
npm run dev
```

Controles de calidad:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Datos y conexión opcional

La demo usa 512 animales ficticios distribuidos entre `Tambo La Esperanza` y `Establecimiento El Ombú`, con 18 meses de historia productiva. Para preparar una conexión nueva, copiar `.env.example` a `.env` y completar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Sin esas variables, la aplicación continúa en modo local.

## Despliegue

`npm run build` genera `dist/`. `vercel.json` configura Vite, el fallback SPA y el service worker. Las capturas verificadas están en `docs/screenshots/`.
