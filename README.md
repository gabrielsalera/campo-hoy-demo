# Campo Hoy

Demo comercial PWA para controlar hacienda, reproducción, nacimientos, movimientos, sanidad y tareas aun con conectividad limitada. La versión heredada 8.6 se conserva y evoluciona incrementalmente: usa IndexedDB como persistencia local y Supabase como sincronización autenticada.

## Ejecutar

```bash
python3 -m http.server 4173
# abrir http://localhost:4173 y elegir “Ingresar a la demo”
npm run check
npm run build
```

No abra `index.html` con `file://`: el service worker y las solicitudes de datos requieren HTTP. `config.js` contiene únicamente una clave pública publicable; para otro proyecto copie `.env.example` y adapte la inyección durante el despliegue. Nunca use `service_role` en el navegador.

## Funcionalidad disponible

- Dashboard operacional navegable, agenda y filtros con detalle.
- Hacienda, trazabilidad individual, nacimientos, movimientos, reproducción de vaquillonas y sanidad.
- Formularios que persisten en IndexedDB, respaldo JSON e importación de siete libros Excel.
- PWA instalable, shell offline y sincronización autenticada idempotente por registro.
- Acceso demo local, sin credenciales y claramente separado del entorno productivo.

## Supabase

La migración `supabase/migrations/202608020001_core.sql` crea organizaciones, establecimientos, membresías, registros, auditoría y analítica con RLS. `supabase/seed.sql` crea los establecimientos ficticios **Tambo Soutomayor** y **Campo Galisteo**. Con Supabase CLI autorizado: `supabase start`, `supabase db reset` y `supabase gen types typescript --local > database.types.ts`.

## Demo y seguridad

El modo demo usa exclusivamente datos ficticios locales. El login Supabase conserva sesión y habilita continuidad offline en el dispositivo. Antes de un uso productivo deben aplicarse las migraciones, crear usuarios Auth y validar las políticas con pruebas RLS. Consulte `docs/SECURITY.md` y `docs/KNOWN_LIMITATIONS.md`.

## Despliegue

`npm run build` genera `dist/`. `vercel.json` configura la salida, fallback SPA y revalidación del service worker. GitHub Actions ejecuta chequeo sintáctico, pruebas y build. No se afirma un despliegue público sin URL comprobada.

## Documentación

La especificación, arquitectura, base, sincronización, despliegue, analítica, guion comercial, limitaciones y próximos pasos están en [`docs/`](docs/).
