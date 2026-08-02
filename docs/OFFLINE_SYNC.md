# Offline y sincronización
1. El shell y datos iniciales se cachean; IndexedDB conserva cambios.
2. Cada entidad tiene UUID y `updated_at`; las escrituras remotas usan upsert.
3. Al reconectar se vacían borrados/reemplazos pendientes y se fusiona la versión más reciente.
4. La migración agrega `sync_id` único por organización y `version` para el siguiente paso: rechazo explícito de versiones antiguas.

Verificado programáticamente: precache y persistencia implementados. Pendiente: Playwright cerrando/reabriendo contexto, conflicto concurrente y confirmación en un segundo dispositivo contra Supabase real.
