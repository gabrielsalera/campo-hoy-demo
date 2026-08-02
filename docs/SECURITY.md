# Seguridad
RLS está habilitado en todas las tablas nuevas. Lectura exige membresía activa en organización/establecimiento; escritura productiva excluye `readonly` y comprueba `auth.uid()`. La clave anon es publicable y jamás sustituye RLS. No se almacena `service_role`, contraseña ni token en el repositorio.

Antes de producción: probar matriz de roles con dos organizaciones, endurecer inserción anónima de analítica mediante Edge Function con rate limit/CAPTCHA, configurar buckets privados y revisar la política de continuidad offline del dispositivo compartido. El acceso demo no crea sesión Supabase y no sincroniza.
