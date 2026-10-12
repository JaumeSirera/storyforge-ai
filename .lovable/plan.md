# Integrar "Story Weaver Social" en Xandralyze (solo administradores)

## Qué es
Un estudio para convertir un texto, documento, imagen o vídeo en una serie de capítulos para redes sociales. La IA lo divide sin inventar nada. Los capítulos se programan y se publican con **Ayrshare** en las redes que actives.

## Qué verás en Xandralyze
Una nueva sección **"Redes sociales"** dentro de Administración. Solo la ve quien tiene el rol admin; cualquier otra persona recibe "Acceso restringido". Tiene tres pestañas:
- **Estudio:** crear una serie a partir de un texto, un PDF o una imagen; editar capítulos con negrita y enlaces; añadir fotos o vídeos; ver cómo queda en cada red; publicar ahora o programar.
- **Calendario:** fechas de publicación de cada capítulo.
- **Redes:** activar o desactivar las redes de cada serie (Instagram, X, LinkedIn, Facebook, TikTok, Threads, YouTube). Las cuentas de esas redes se enlazan dentro de tu panel de Ayrshare.

La pantalla de **Autorizaciones** no se incluye.

## Independencia de Lovable
| En el original | En Xandralyze |
|---|---|
| Base de datos de Lovable Cloud | Tablas nuevas en tu MySQL, que se crean solas |
| Archivos de Lovable | Tu carpeta `xandralyze-archivos` |
| IA de Lovable | Tu propia clave de IA (Ajustes) |
| Conectores LinkedIn/TikTok de Lovable | Se quitan: todo se publica por Ayrshare |
| Cron de Lovable | Tarea cron de cPanel cada 5 minutos |

## Lo que tendrás que hacer
1. Pegar tu clave de Ayrshare en Ajustes de Xandralyze. Se guarda en tu servidor y nunca llega al navegador.
2. Subir los paquetes nuevos de la web y de la API, como siempre.
3. Crear la tarea cron en cPanel (te daré la línea exacta).

## Limitaciones
- Las redes que puedes usar dependen de tu plan de Ayrshare.
- No se traen los datos guardados en Story Weaver Social. Si los quieres, preparo una importación.

## Detalles técnicos
- API PHP: `api-php/src/Social.php` con tablas que se crean solas: `app_social_stories`, `app_social_chapters` (con `links`, `media_ids` y `networks` en JSON, `scheduled_at`, `status`) y `app_social_media`. Rutas `/api/v1/social/*` en `index.php`, que exigen el rol admin en `app_user_roles`.
- Clave de Ayrshare: columna nueva `ayrshare_key` en las claves del usuario, en el mismo sitio que las demás claves de Ajustes.
- Web: rutas `src/routes/_authenticated/app.admin.social.{index,calendar,networks}.tsx` con los componentes copiados (`NetworkPreview`, `BoldTextarea`, `ChapterLinks`, `EditableTitle`), adaptados a los tokens de Xandralyze. Pestaña "Redes sociales" en `app.admin.tsx`.
- `src/lib/social.functions.ts`: usa `requireAnyAuth` más una comprobación de admin. La generación usa `ai-gateway.server.ts` con las claves del usuario, y la publicación `social-publish.server.ts` (Ayrshare `/api/post`).
- Cron: `src/routes/api/public/social/publish-due.ts`, protegido con `SOCIAL_CRON_SECRET`.
- Regla nueva en `AGENTS.md`. Paquetes nuevos: web v9 y API v4.
