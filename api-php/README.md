# API externa (PHP + MySQL) para Xandralyze

Esta carpeta contiene una API propia que puedes subir a tu hosting (LucusHost u
otro con PHP 8.1+ y MySQL 8 / MariaDB 10.5+). Sirve para que **los datos** vivan
en tu servidor, mientras las **cuentas de usuario** siguen gestionadas por
Lovable Cloud (registro, contraseña, Google, recuperación de clave).

## Cómo encaja

```text
Navegador  ->  App Xandralyze  ->  tu API PHP  ->  tu MySQL
                     |
                     +-> Lovable Cloud (solo identidad: quién es el usuario)
```

Cada petición que la app hace a tu API lleva el token del usuario. La API
pregunta a Lovable Cloud "¿de quién es este token?" y solo devuelve o modifica
las filas de ese usuario. Así nadie puede ver datos de otro.

## Instalación

1. Sube el contenido de esta carpeta al servidor, con `public/` como raíz del
   dominio o subdominio (por ejemplo `api.xandralyze.com`).
2. Crea la base de datos e importa `schema.mysql.sql`.
3. Copia `.env.example` a `.env` (fuera de `public/`) y rellena los valores.
4. Comprueba que responde: `GET https://api.xandralyze.com/api/v1/health`.
5. En Xandralyze, guarda `EXTERNAL_API_URL` y `EXTERNAL_API_TOKEN` como secretos.

Requiere HTTPS y las extensiones `pdo_mysql`, `curl` y `json`.

## Endpoints

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/api/v1/health` | Comprueba servidor y base de datos |
| GET | `/api/v1/{recurso}` | Lista las filas del usuario (`?limit=&offset=&order=&{campo}=`) |
| GET | `/api/v1/{recurso}/{id}` | Una fila |
| POST | `/api/v1/{recurso}` | Crea |
| PATCH | `/api/v1/{recurso}/{id}` | Modifica |
| DELETE | `/api/v1/{recurso}/{id}` | Borra |

Recursos disponibles en esta primera fase (módulo de evaluaciones):
`assessments`, `assessment_candidates`, `assessment_submissions`,
`assessment_annotations`, `assessment_collaborators`, `question_bank_items`,
`exam_audit_log`.

## Traslado de los datos actuales

El paso de datos se hace tabla por tabla, exportando desde la base actual e
importando en MySQL. Se recomienda hacerlo módulo a módulo y mantener los dos
sitios funcionando hasta comprobar que todo cuadra.

## Lo que NO se mueve aquí

- Cuentas y contraseñas (siguen en Lovable Cloud).
- Archivos: fotos, exámenes escaneados, vídeos y grabaciones. Eso requiere un
  paso aparte, con almacenamiento en tu servidor o en S3.
