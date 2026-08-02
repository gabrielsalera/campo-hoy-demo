# Arquitectura
La versión 8.6 existente es una PWA sin bundler: HTML/CSS/JavaScript, IndexedDB con stores por agregado y un cliente REST Supabase mínimo. Se conserva para evitar pérdida de funcionalidad y datos importados. El service worker precachea shell y datasets; los formularios escriben primero local y la nube reconcilia por identificador.

La evolución objetivo separa UI, dominio y adaptadores: IndexedDB es repositorio offline; Supabase/PostgreSQL es fuente compartida; `sync_id` único hace los comandos idempotentes; `version` permite detectar conflicto. La migración inicial introduce tenant, establecimiento, membresía, evento genérico y auditoría sin cortar el backend heredado `campo_records`.
