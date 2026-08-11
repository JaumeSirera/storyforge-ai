/**
 * Combina la pista de cámara y la de pantalla en un único vídeo sincronizado
 * (pantalla a pantalla completa + cámara como recuadro), todo en el navegador:
 * se reproducen ambas pistas, se dibujan en un canvas y se graba el resultado
 * junto al audio mezclado. Así el usuario puede compartir un solo archivo.
 *
 * El recuadro se dibuja en la misma esquina y con el mismo tamaño relativo que
 * el usuario ha elegido en el reproductor (preferencias PIP de la sesión).
 */

import { pipRect, type Corner, type PipSize } from "./pip-prefs";

export interface ComposeInput {
  screenUrl: string;
  cameraUrl: string;
  /** Desplazamiento de sincronización de cada pista respecto al juego (ms). */
  screenOffsetMs?: number;
  cameraOffsetMs?: number;
  /** Duración conocida (s) para estimar el progreso. */
  durationSec?: number | null;
  /** Layout del recuadro tal como se ve en el reproductor. */
  pipCorner?: Corner;
  pipSize?: PipSize;
  /** Si el recuadro está oculto en el reproductor, se exporta solo la pantalla. */
  pipVisible?: boolean;
  onProgress?: (ratio: number) => void;
}


function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.src = url;
    v.preload = "auto";
    v.playsInline = true;
    v.muted = false;
    const done = () => resolve(v);
    v.addEventListener("loadeddata", done, { once: true });
    v.addEventListener("error", () => reject(new Error("No se pudo cargar una de las pistas")), {
      once: true,
    });
  });
}

function pickMime() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

/** Devuelve un Blob con el vídeo combinado (cámara + pantalla). */
export async function composeCameraAndScreen(input: ComposeInput): Promise<Blob> {
  const [screen, camera] = await Promise.all([
    loadVideo(input.screenUrl),
    loadVideo(input.cameraUrl),
  ]);

  const W = 1280;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no permite combinar vídeo (canvas 2D no disponible)");

  // La pista con menor offset empieza antes; la otra espera la diferencia.
  const camOff = input.cameraOffsetMs ?? 0;
  const scrOff = input.screenOffsetMs ?? 0;
  const base = Math.min(camOff, scrOff);
  const camDelay = (camOff - base) / 1000;
  const scrDelay = (scrOff - base) / 1000;

  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  for (const el of [camera, screen]) {
    try {
      const src = audioCtx.createMediaElementSource(el);
      src.connect(dest);
    } catch {
      /* pista sin audio */
    }
  }

  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const expected = Math.max(
    input.durationSec && Number.isFinite(input.durationSec) ? input.durationSec : 0,
    Number.isFinite(screen.duration) ? screen.duration : 0,
    Number.isFinite(camera.duration) ? camera.duration : 0,
    1,
  );

  let raf = 0;
  const startedAt = performance.now();
  const corner = input.pipCorner ?? "br";
  const pipSize = input.pipSize ?? "md";
  const showPip = input.pipVisible !== false;
  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawCover(ctx, screen, 0, 0, W, H);
    if (showPip) {
      // Recuadro de cámara en la esquina y tamaño elegidos en el reproductor.
      const camAspect =
        camera.videoWidth && camera.videoHeight
          ? camera.videoWidth / camera.videoHeight
          : 16 / 9;
      const { x, y, w: pipW, h: pipH } = pipRect(corner, pipSize, W, H, camAspect);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#111";
      ctx.fillRect(x - 2, y - 2, pipW + 4, pipH + 4);
      ctx.restore();
      drawCover(ctx, camera, x, y, pipW, pipH);
    }
    input.onProgress?.(Math.min(0.99, (performance.now() - startedAt) / 1000 / expected));
    raf = requestAnimationFrame(draw);
  };


  const finished = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => {
      cancelAnimationFrame(raf);
      void audioCtx.close();
      const blob = new Blob(chunks, { type: chunks[0]?.type || mime || "video/webm" });
      if (blob.size < 2048) reject(new Error("El vídeo combinado quedó vacío"));
      else resolve(blob);
    };
    rec.onerror = () => reject(new Error("Error al combinar el vídeo"));
  });

  rec.start(1000);
  raf = requestAnimationFrame(draw);

  const play = async (el: HTMLVideoElement, delay: number) => {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay * 1000));
    el.currentTime = 0;
    await el.play().catch(() => undefined);
    await new Promise<void>((resolve) => {
      el.addEventListener("ended", () => resolve(), { once: true });
      // Salvavidas por si el navegador no reporta el final (WebM sin duración).
      const guard = setInterval(() => {
        if (el.paused && el.currentTime > 0) {
          clearInterval(guard);
          resolve();
        }
      }, 1000);
    });
  };

  await Promise.all([play(camera, camDelay), play(screen, scrDelay)]);
  // Pequeño margen para no cortar el último fotograma.
  await new Promise((r) => setTimeout(r, 400));
  if (rec.state !== "inactive") rec.stop();
  const blob = await finished;
  input.onProgress?.(1);
  return blob;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  el: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const vw = el.videoWidth || w;
  const vh = el.videoHeight || h;
  if (!vw || !vh) return;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
