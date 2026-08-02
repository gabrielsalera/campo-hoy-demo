# Base de datos
`organizations` delimita tenant; `farms` delimita establecimiento; `memberships` une Auth, rol y alcance. `records` aloja eventos durante la transición, con evento real, carga, autor, origen, dispositivo, sincronización, borrado lógico y versión. El índice parcial cubre consultas operativas. `audit_log` es append-only. Analítica y contactos están separados del dato productivo.

Recreación local: `supabase start && supabase db reset`. El seed contiene solo entidades ficticias. Los 519 animales y 12–18 meses de historia actuales viven en `data/*.json`; su normalización SQL es trabajo pendiente declarado.
