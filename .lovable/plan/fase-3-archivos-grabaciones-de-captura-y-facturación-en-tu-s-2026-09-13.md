# Fase 3: archivos, grabaciones de captura y facturación en tu servidor

Objetivo: que los vídeos, escaneos y fotos, las grabaciones de captura y los datos de
facturación vivan en tu servidor (api.xandralyze.com + MySQL). Las cuentas, contraseñas
y el envío de correo siguen en Lovable Cloud, como acordamos.

## 1. Archivos (vídeos, escaneos, fotos, grabaciones, imágenes de marca)

Tu servidor pasa a guardar los archivos en disco, fuera de la carpeta pública, y la
aplicación pide enlaces temporales para verlos o descargarlos.

Nuevos ficheros PHP que prepararé para que los subas:
- `api-php/src/Files.php` — guarda, lee, borra archivos y firma enlaces temporales
  (caducidad de 1 hora, firma con la clave compartida).
- Rutas nuevas en `api-php/public/index.php`:
  - `POST /api/v1/files/{contenedor}/{ruta}` subir
  - `GET /api/v1/files/{contenedor}/{ruta}` descargar (uso interno de la app)
  - `DELETE /api/v1/files/{contenedor}/{ruta}` borrar
  - `POST /api/v1/files/sign` devuelve un enlace temporal
  - `GET /api/v1/file/{token}` sirve el archivo con ese enlace temporal (público, sin
    clave, caduca y va firmado)
- Contenedores: `recordings`, `videos`, `assessments`, `characters`, `participants`,
  `branding`. Cada archivo se guarda bajo `{contenedor}/{ruta original}`, así los
  identificadores que ya hay en la base de datos siguen siendo válidos.

En la aplicación creo `src/lib/external-storage.server.ts`: una capa con las mismas
operaciones que se usan hoy (`upload`, `download`, `remove`, `createSignedUrl`) y un
selector que la activa solo cuando existe el secreto `EXTERNAL_FILES=1`. Los puntos que
suben o leen archivos pasan por ella: entregas de evaluaciones, grabaciones de captura,
vídeos e imágenes generadas por IA, personajes, voz, marca y ajustes.

Las subidas desde el navegador (grabaciones y logotipo) pasarán a hacerse contra una
función del servidor de la aplicación, para no exponer nunca la clave compartida.

**Aviso importante sobre las grabaciones de vídeo:** los vídeos de captura pueden pesar
cientos de megabytes. Antes de activarlo hay que confirmar dos cosas de tu hosting:
espacio disponible y tamaño máximo de subida por petición (`upload_max_filesize` y
`post_max_size`). Si tu hosting es limitado, lo sensato es dejar las grabaciones en
Lovable Cloud y mover solo escaneos, fotos e imágenes. El diseño permite elegirlo
contenedor por contenedor.

## 2. Grabaciones de captura (datos, no archivos)

Tablas nuevas en `api-php/schema.mysql.sql`: `capture_sessions`, `capture_participants`,
`capture_recordings`, `capture_transcript_segments`, `capture_analyses`,
`capture_scene_annotations`, `capture_hypothesis_reviews`,
`capture_hypothesis_review_events`, `capture_consents`, `capture_invitations`,
`capture_preferences`.

Permisos en `api-php/src/Repo.php`: cada tabla se limita por `owner_id` y, cuando
corresponde, por pertenencia a la sesión de captura del propietario (igual que ya hicimos
con evaluaciones). El acceso de un participante invitado sigue validándose por su token.

En la aplicación: `capture.functions.ts`, `capture-invitations.functions.ts`,
`analyze.functions.ts`, `insights.functions.ts`, `compare-scenes.functions.ts`,
`scene-annotations.functions.ts` e `hypothesis-reviews.functions.ts` pasan a usar el
selector `xdb`/`xAdminDb` que ya existe. Se activan con el secreto `EXTERNAL_API_PHASE3=1`.

## 3. Facturación

Tablas nuevas: `user_billing`, `redsys_payments`, `pricing_config`.

`pricing_config` es global (una sola fila) y solo el administrador la cambia; en tu
servidor se marca como lectura para cualquiera y escritura solo en modo servicio.
`user_billing` y `redsys_payments` solo se escriben en modo servicio: el navegador nunca
puede modificarlas, igual que hoy.

En la aplicación: `billing.functions.ts`, `pricing.functions.ts`, `usage.server.ts` y
las rutas de Redsys (`notification.ts`, `charge-recurring.ts`) pasan por el selector.

## 4. Copia de los datos y de los archivos

Amplío `src/routes/api/public/migrate-assessments.ts` para copiar, en orden seguro,
las tablas de captura y de facturación, y para transferir los archivos existentes de
Lovable Cloud a tu servidor contenedor por contenedor, con reintentos y un resumen
final (copiados, omitidos, fallidos). Los identificadores y rutas se conservan, así que
nada se rompe a mitad de camino.

## 5. Orden de trabajo

1. Escribo el código de la aplicación y los ficheros PHP (tú los subes).
2. Subes `src/Files.php`, `src/Repo.php`, `public/index.php` y el nuevo `schema.mysql.sql`.
3. Activo `EXTERNAL_API_PHASE3` y copio los datos de captura y facturación; compruebo en
   la aplicación real que se ve todo.
4. Solo después, y con tus límites de hosting confirmados, activo `EXTERNAL_FILES` y
   copio los archivos por contenedores, empezando por los pequeños (marca, personajes,
   escaneos) y dejando las grabaciones de vídeo para el final.

## Lo que sigue en Lovable Cloud

Cuentas, contraseñas, inicio de sesión con Google y el envío de correo.
