# Limitaciones conocidas
- La UI heredada usa los establecimientos Ino, Ino 2 y Los 3 Hnos.; los dos nombres comerciales requeridos ya existen en el seed pero falta migrar los datasets/UI.
- El backend actual sincroniza JSON en `campo_records`; las tablas normalizadas nuevas aún no están conectadas a la UI.
- Producción lechera, inventario, encuesta, leads y tablero comercial no tienen flujo UI terminado.
- No se ejecutaron Supabase, pruebas RLS, E2E offline multidispositivo ni despliegues públicos por falta de CLI/autorización.
- El desbloqueo offline heredado debe revisarse antes de usar dispositivos compartidos en producción.
