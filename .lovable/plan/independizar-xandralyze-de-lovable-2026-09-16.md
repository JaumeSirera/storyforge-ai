# Independizar Xandralyze de Lovable

Objetivo: cuentas, correos y la propia web funcionando en tu hosting, con el dominio xandralyze.com apuntando allí. Los datos y archivos ya están en tu MySQL desde el traspaso anterior.

Un aviso importante antes de empezar: en FitHub Central las cuentas **no** están en tu servidor, siguen en Lovable (allí solo se movieron los datos a MySQL). Así que esto no es copiar lo de FitHub: hay que construir el sistema de cuentas nuevo en tu API. Lo hago por fases, y cada una queda estable antes de pasar a la siguiente.

## Fase A — Cuentas en tu servidor

- Tablas nuevas en tu MySQL: usuarios (email, contraseña cifrada, nombre, verificación), roles, sesiones activas, códigos de recuperación y de verificación.
- Endpoints nuevos en tu API: crear cuenta, entrar, salir, renovar sesión, "quién soy", recuperar contraseña, cambiar contraseña, verificar email.
- La aplicación deja de usar el sistema de cuentas de Lovable: nueva pantalla de acceso conectada a tu API, la sesión se guarda en el navegador y todas las páginas privadas se protegen con tu propio permiso.
- Traspaso de los usuarios actuales: los correos y nombres se copian, pero **las contraseñas no se pueden exportar** de Lovable. Cada usuario recibirá un correo para establecer su contraseña la primera vez. Los identificadores de usuario se conservan, así que nadie pierde sus simulaciones, evaluaciones ni facturación.
- Entrada con Google: queda para el final de esta fase (requiere crear credenciales de Google con tu dominio; te indicaré los pasos).

## Fase B — Correos por tu hosting

- Envío por SMTP de tu buzón contacto@xandralyze.com desde tu API (invitaciones a candidatos, informes, verificación y recuperación de contraseña).
- Se mantiene el registro de envíos y los reintentos que ya existen, pero apuntando a tu servidor en vez de a Lovable.
- Necesitaré que guardes en tu servidor el usuario y la contraseña del buzón (no pasan por el chat: los pones en el archivo de configuración de la API, como hicimos con la clave compartida).
- Nota de entrega: enviando desde tu hosting es normal que algún correo caiga en spam al principio; para evitarlo hay que dejar bien puestos los registros SPF/DKIM/DMARC del dominio en tu proveedor de DNS. Te daré los valores exactos.

## Fase C — La web en tu hosting

Aquí está el trabajo grande. Hoy buena parte de la aplicación se ejecuta en los servidores de Lovable (generación con IA, PDF, pagos Redsys, firmas de archivos). Un hosting PHP no puede ejecutar ese código, así que:

- La web pasa a ser una aplicación que se ejecuta entera en el navegador, publicable como archivos estáticos en tu hosting.
- Toda la lógica que hoy corre en Lovable se traslada a tu API PHP: llamadas a la IA, generación de informes, avisos por correo, pagos y enlaces firmados de archivos.
- Tus claves de IA y de Redsys pasan a estar en tu servidor, no en Lovable.
- Cuando esté probado, el dominio xandralyze.com se apunta a tu hosting y Lovable queda solo como herramienta para seguir editando el código.

## Qué necesito de ti

1. Fase A: subir los archivos PHP nuevos que prepare y ejecutar el SQL en tu base (como en el traspaso anterior).
2. Fase B: crear/confirmar el buzón contacto@xandralyze.com y poner sus datos en la configuración de la API.
3. Fase C: acceso al hosting para subir los archivos de la web (o FTP/panel donde publicarla) y decidir el momento de cambiar el dominio.

## Detalle técnico

- Auth propia: JWT HS256 de vida corta + refresh token rotatorio en tabla, `password_hash` con `password_hash()` de PHP (bcrypt), rate limiting por IP/email. `Auth.php` pasa a validar el JWT propio y mantiene compatibilidad temporal con el token de Lovable durante la transición.
- Cliente: `src/lib/auth-client.ts` + contexto React sustituyen a `supabase.auth`; las server functions con `requireSupabaseAuth` se reemplazan por validación del JWT propio mientras siga viva la parte SSR.
- Correo: PHPMailer sobre SMTP (TLS 587), endpoint `/api/v1/mail/send` protegido por `APP_TOKEN`, plantillas React Email pre-renderizadas a HTML.
- Fase C: build en modo SPA (sin SSR), `.htaccess` con fallback a `index.html`; migración de `src/lib/*.functions.ts` a endpoints PHP equivalentes.
