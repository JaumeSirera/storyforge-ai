// Convierte imágenes en un vídeo tipo presentación, todo en el navegador
// (canvas + MediaRecorder), sin servidores ni servicios externos.

export type SlideshowOptions = {
  title?: string;
  secondsPerImage?: number;
  width?: number;
  height?: number;
  onProgress?: (p: number) => void;
};

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer una imagen (${res.status})`);
  return createImageBitmap(await res.blob());
}

function pickMime(): { mime: string; ext: string } {
  const opts = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  for (const o of opts) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) return o;
  throw new Error("Este navegador no puede crear vídeos. Prueba con Chrome o Edge.");
}

function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap, W: number, H: number, zoom: number, alpha: number) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * s, h = img.height * s;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.globalAlpha = 1;
}

export async function createSlideshow(urls: string[], o: SlideshowOptions = {}): Promise<File> {
  if (!urls.length) throw new Error("Añade al menos una imagen al capítulo");
  const W = o.width ?? 1920, H = o.height ?? 1080;
  const per = (o.secondsPerImage ?? 3) * 1000;
  const fade = 600;
  const titleMs = o.title ? 2500 : 0;
  const imgs = await Promise.all(urls.map(loadBitmap));
  const total = titleMs + imgs.length * per;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const { mime, ext } = pickMime();
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));

  const frame = (t: number) => {
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (t < titleMs) {
      const a = Math.min(1, t / 400, (titleMs - t) / 400);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.round(H / 14)}px system-ui, sans-serif`;
      const words = (o.title ?? "").split(/\s+/); const lines: string[] = []; let cur = "";
      for (const w of words) { const n = cur ? `${cur} ${w}` : w; if (ctx.measureText(n).width > W * 0.8 && cur) { lines.push(cur); cur = w; } else cur = n; }
      if (cur) lines.push(cur);
      const lh = H / 11;
      lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh));
      ctx.globalAlpha = 1;
      return;
    }
    const it = t - titleMs;
    const i = Math.min(imgs.length - 1, Math.floor(it / per));
    const local = it - i * per;
    drawCover(ctx, imgs[i], W, H, 1 + 0.08 * (local / per), 1);
    if (local > per - fade && i + 1 < imgs.length) {
      drawCover(ctx, imgs[i + 1], W, H, 1, (local - (per - fade)) / fade);
    }
  };

  frame(0);
  rec.start(500);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - start;
      frame(Math.min(t, total));
      o.onProgress?.(Math.min(1, t / total));
      if (t >= total) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  imgs.forEach((b) => b.close());
  const type = mime.split(";")[0];
  return new File([new Blob(chunks, { type })], `presentacion-${Date.now()}.${ext}`, { type });
}
