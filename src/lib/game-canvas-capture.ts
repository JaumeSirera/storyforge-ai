/**
 * Captura interna del juego para móviles y tablets.
 *
 * Los navegadores móviles no exponen `getDisplayMedia`, así que no se puede
 * compartir la pantalla del dispositivo. En su lugar grabamos lo que la propia
 * app muestra: el fotograma actual del vídeo de la escena más el texto en
 * pantalla (subtítulo, pregunta o comentario), compuesto en un <canvas> cuyo
 * `captureStream()` sí funciona en iOS y Android.
 */

const WIDTH = 1280;
const HEIGHT = 720;

let currentVideo: HTMLVideoElement | null = null;
let caption = "";

/** El reproductor registra aquí su elemento <video> visible. */
export function registerGameVideo(el: HTMLVideoElement | null) {
  if (el === null && currentVideo === null) return;
  currentVideo = el;
}

/** Texto sobreimpreso en la pista grabada (subtítulo, pregunta, comentario…). */
export function setGameCaption(text: string | null | undefined) {
  caption = (text ?? "").trim();
}

export function getGameCaption() {
  return caption;
}

/** ¿Hay algo del juego que podamos grabar en este momento o más adelante? */
export function canCaptureGameCanvas(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return (
    typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream === "function"
  );
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, max = 3) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === max) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < max) lines.push(line);
  return lines;
}

/**
 * Crea un MediaStream con la composición del juego. Devuelve null si el
 * navegador no soporta `canvas.captureStream()`.
 */
export function createGameCaptureStream(fps = 24): MediaStream | null {
  if (!canCaptureGameCanvas()) return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let stopped = false;
  let raf = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const draw = () => {
    if (stopped) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const v = currentVideo;
    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      const scale = Math.min(WIDTH / v.videoWidth, HEIGHT / v.videoHeight);
      const w = v.videoWidth * scale;
      const h = v.videoHeight * scale;
      try {
        ctx.drawImage(v, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
      } catch {
        /* fotograma no disponible todavía */
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "28px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Esperando el vídeo del juego…", WIDTH / 2, HEIGHT / 2);
    }

    if (caption) {
      ctx.font = "600 32px system-ui, sans-serif";
      ctx.textAlign = "center";
      const lines = wrapLines(ctx, caption, WIDTH - 160);
      const boxH = lines.length * 44 + 32;
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(60, HEIGHT - boxH - 40, WIDTH - 120, boxH);
      ctx.fillStyle = "#fff";
      lines.forEach((l, i) => {
        ctx.fillText(l, WIDTH / 2, HEIGHT - boxH - 40 + 44 + i * 44);
      });
    }
  };

  const loop = () => {
    draw();
    if (!stopped) raf = requestAnimationFrame(loop);
  };

  if (typeof requestAnimationFrame === "function") loop();
  else timer = setInterval(draw, Math.round(1000 / fps));

  const stream = (canvas as HTMLCanvasElement).captureStream(fps);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    if (timer) clearInterval(timer);
  };
  stream.getVideoTracks().forEach((t) => {
    const originalStop = t.stop.bind(t);
    t.stop = () => {
      stop();
      originalStop();
    };
    t.addEventListener("ended", stop);
  });
  return stream;
}
