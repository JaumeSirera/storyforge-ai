# Generar la carpeta de la web desde tu ordenador

Sirve para crear el paquete que se sube a `xandralyze-web` sin depender de nadie:
descargas el código, lo compilas y te sale la carpeta ya preparada.

## Requisitos

- **Node.js 22** (en el hosting tienes el 22.23.2; con cualquier 22.x vale).
  Comprueba la versión con `node -v`.
- Git, o simplemente descargar el ZIP del repositorio.

## Pasos

```bash
git clone https://github.com/JaumeSirera/storyforge-ai.git
cd storyforge-ai
npm install
npm run build:web
```

Al terminar se crea la carpeta **`.output`** con esto dentro:

```text
.output/
├── nitro.json
├── public/     -> se sube como public
└── server/     -> se sube como server
```

## Comprobarlo antes de subirlo (opcional)

```bash
node .output/server/index.mjs
```

Abre <http://localhost:3000> y verás la web funcionando en tu ordenador.
Si quieres otra puerta: `PORT=8080 node .output/server/index.mjs`.
Para pararla: `Ctrl` + `C`.

## Subirlo al hosting

1. Entra en cPanel y ve a la carpeta `xandralyze-web`.
2. Borra las carpetas `server` y `public` que haya ahora.
3. Sube el contenido de `.output` (las carpetas `server` y `public` y el fichero
   `nitro.json`). Puedes comprimirlos antes en un ZIP y descomprimirlo allí.
4. En **Setup App**, pulsa **Stop** y luego **Start**.

## Cosas que no deben subir a `xandralyze-web`

`node_modules`, `src`, `api-php`, `package.json` y el resto del código original:
eso es el código fuente, no la web ya preparada.

La API de `api.xandralyze.com` se sube aparte: es la carpeta `api-php`
(`src/` y `public/`), y no hace falta reiniciar nada al cambiarla.

## Avisos

- **No borres el fichero `.env`** antes de compilar: lleva la dirección del
  backend donde están las cuentas. Sin él, la web se compila pero no se puede
  iniciar sesión.
- Si al compilar aparece `preset: "cloudflare"` en vez de `"node-server"` en
  `.output/nitro.json`, estás compilando dentro del entorno de Lovable. Hazlo en
  tu ordenador.
- El primer `npm install` puede tardar varios minutos.
