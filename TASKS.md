# Plan verificable

| Etapa | Estado | Evidencia / siguiente paso |
|---|---|---|
| Auditoría de la versión 8.6 heredada | Terminada | Aplicación estática PWA, IndexedDB, importación Excel y sincronización genérica inspeccionadas. |
| Acceso comercial sin credenciales | Probada | Botón **Ingresar a la demo**, datos locales ficticios y prueba automatizada. |
| Build reproducible y CI | Probada | `npm run check`, `npm run build`, workflow GitHub Actions. |
| Modelo multi-organización y RLS | Terminada | Migración versionada; aplicación en Supabase remoto pendiente de autorización. |
| Stock, animales, nacimientos, movimientos, sanidad y tareas heredados | Probada | Flujos CRUD locales existentes; falta migrarlos del registro JSON genérico a tablas normalizadas. |
| Offline PWA | Probada | Shell/datos precargados e IndexedDB; falta E2E real multidispositivo. |
| Producción lechera, inventario, alertas explicables | Pendiente | Próximos flujos verticales. |
| Analítica, encuesta y leads | En progreso | Tablas con RLS creadas; UI y captura pendientes. |
| GitHub / Supabase / Vercel públicos | Bloqueada | Requiere autorización externa; configuración local lista. |
