CAMPO HOY 8.3 — CORRECCIÓN DE SINCRONIZACIÓN

Corrección principal:
- Supabase limita por defecto las consultas a 1.000 filas.
- La versión anterior descargaba solo las primeras 1.000 filas de profiles, por eso algunos dispositivos mostraban 199 activos.
- Esta versión pagina la descarga hasta traer todos los registros.
- Usa una IndexedDB nueva para no conservar la copia incompleta.
- Si Supabase devuelve menos de 1.279 perfiles, cancela la sincronización y no reemplaza la base local.

Valores esperados después de iniciar sesión:
- Ino 2: 146 activos
- Los 3 Hnos.: 152 activos
- Total: 298 activos
