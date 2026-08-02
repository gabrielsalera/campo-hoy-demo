# Despliegue
## Local
`npm ci && npm run check && npm run build`. Servir `dist/` mediante HTTP.
## Supabase
Autorizar CLI, vincular el proyecto, ejecutar `supabase db push`, cargar `supabase/seed.sql`, crear usuarios Auth ficticios y ejecutar pruebas de RLS.
## Vercel
Importar el repositorio, usar `npm run build`, salida `dist`, configurar URL/anon key públicas y desplegar. Verificar `/`, recarga de rutas, manifest, `sw.js`, login, modo offline y consola. La publicación está bloqueada hasta disponer de autorización de GitHub/Vercel/Supabase.
