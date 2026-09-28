# Ajustes (claves de IA y correo) para las cuentas propias

## Problema
Quien entra con las cuentas de tu servidor no puede ver ni guardar sus claves de IA ni la configuración de correo: esos datos siguen en la base antigua, que no reconoce la nueva sesión.

## Qué haré
- Llevar las tablas `user_api_keys`, `email_settings` y los datos de perfil que se usan (p. ej. "usar IA de la plataforma") a tu API PHP, igual que las demás tablas.
- Añadirlas al esquema MySQL (`api-php/schema.mysql.sql`) y a la lista de recursos de `api-php/src/Repo.php` (con aislamiento por propietario).
- Enrutar `user-keys.functions.ts`, `email-settings.functions.ts` y las lecturas de perfil por `xdb(context)` en vez de `context.supabase`.
- Copiar los datos existentes con un script de migración como los anteriores.
- Mostrar el error en vez de devolver claves vacías si la lectura falla.

## Lo que tendrás que hacer tú
Ejecutar el SQL nuevo y subir `Repo.php` al hosting.
