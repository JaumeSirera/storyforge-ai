# Integrar "Story Weaver Social" en Xandralyze (solo administradores)

## Qué es Story Weaver Social
Un estudio para convertir un texto, documento, imagen o vídeo en una serie de capítulos para redes sociales. La IA lo divide sin inventar nada. Después se programan en un calendario y se publican solos o a mano en Instagram, X, LinkedIn, Facebook, TikTok, Threads y YouTube.

## Qué verás en Xandralyze
Una nueva sección **"Redes sociales"** dentro de Administración. Solo aparece a quien tiene el rol admin, y si otra persona intenta entrar le sale "Acceso restringido". Tiene cuatro pestañas, iguales que en el proyecto original:
- **Estudio:** crear una serie desde un texto, un PDF o una imagen; editar capítulos con negrita y enlaces; añadir fotos o vídeos; vista previa de cómo se ve en cada red.
- **Calendario:** fechas de publicación de cada capítulo.
- **Redes:** qué redes usa cada serie.
- **Autorizaciones:** las claves de cada red social (App ID, token, ID de cuenta…), con la guía paso a paso que ya trae.

Se integra con el estilo, el menú y el logo de Xandralyze. No es una app aparte.

## Independencia de Lovable
| En el proyecto original | En Xandralyze |
|---|---|
| Base de datos de Lovable Cloud | Tablas nuevas en tu MySQL: series, capítulos, archivos, claves de redes y cola de publicación. Se crean solas. |
| Archivos en el almacenamiento de Lovable | Tu carpeta `xandralyze-archivos`, por el mismo camino que el logo |
| IA de Lovable | Tu propia clave de IA (Gemini u OpenAI), la de Ajustes |
| LinkedIn y TikTok por los conectores de Lovable | Conexión directa con tu propio token de cada red, guardado en Autorizaciones |
| Ayrshare (opcional) | Se mantiene como opción con tu propia clave |
| Publicación programada con el cron de Lovable | Tarea cron de cPanel cada 5 minutos, como la de Redsys |

Las claves de las redes se guardan cifradas en tu servidor y nunca se envían al navegador. Solo se pueden ver con el botón "Mostrar".

## Lo que tendrás que hacer
1. Subir los archivos nuevos de la API y la web, como siempre.
2. Crear en cPanel una tarea cron cada 5 minutos para publicar lo programado (te daré la línea exacta).
3. Conseguir los tokens de cada red que quieras usar. Sin token, la red sale como "no conectada" y puedes seguir publicando a mano (copiar el texto y abrir la red).

## Limitaciones
- Instagram, Facebook y Threads necesitan una app de Meta con permisos de publicación. X exige un plan de pago para publicar por la API. TikTok solo admite vídeo. Es lo mismo que en el proyecto original.
- No se traen los datos que tuvieras guardados en Story Weaver Social: su base está en Lovable Cloud. Si los quieres, dímelo y preparo una importación.

## Detalles técnicos
- API PHP: nuevo `api-php/src/Social.php` con tablas auto-creadas (`app_social_stories`, `app_social_chapters` con `links`/`media_ids` JSON, `app_social_media`, `app_social_credentials` cifradas con AES-256-GCM a partir de `AUTH_JWT_SECRET`, `app_social_queue`). Un bloque `/api/v1/social/*` en `index.php` que exige el rol admin en `app_user_roles`, y `/api/v1/social/cron` protegido con `SOCIAL_CRON_SECRET`.
- Web: rutas `src/routes/_authenticated/app.admin.social.*.tsx` (estudio, calendario, redes, autorizaciones), que reutilizan los componentes copiados (`NetworkPreview`, `BoldTextarea`, `ChapterLinks`, `ManualPublish`, `EditableTitle`) adaptados a los tokens de diseño de Xandralyze.
- `src/lib/social.functions.ts` con `requireAnyAuth` y comprobación de admin, llamando a la API propia. La generación de capítulos usa `ai-gateway.server.ts` con las claves del usuario.
- `src/lib/social-publish.server.ts`: publicación directa en las APIs oficiales (Graph de Meta, LinkedIn `ugcPosts`, TikTok Content Posting, X v2, YouTube Data), sin `connector-gateway.lovable.dev`.
- Ruta `src/routes/api/public/social/publish-due.ts`: comprueba el secreto y reenvía a la API PHP. La llama el cron de cPanel.
- Pestaña "Redes sociales" en `app.admin.tsx`; regla nueva en `AGENTS.md`.
- Paquetes nuevos: web v9 y API v4.
