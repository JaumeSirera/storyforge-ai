import { useEffect, useState } from "react";
import type { MediaDeviceSelection } from "@/components/MediaDeviceSelector";
import {
  clearRecovery,
  getRecoverable,
  loadRecoveredBlobs,
  persistChunk,
  persistMeta,
  type RecoveryMeta,
} from "@/lib/capture-recovery";


export type CapturePhase = "idle" | "recording" | "paused" | "uploading";

export interface CaptureUploadPayload {
  blob: Blob;
  kind: "camera" | "screen";
  durationSec: number;
  syncOffsetMs: number;
}

export type CaptureUploader = (payload: CaptureUploadPayload) => Promise<void>;

export interface CaptureStartOptions {
  recordScreen: boolean;
  uploader: CaptureUploader;
  getGameOffsetMs?: () => number;
  selection?: MediaDeviceSelection | null;
}

interface Entry {
  key: string;
  label: string;
  phase: CapturePhase;
  previewOn: boolean;
  startedAt: number;
  pausedMs: number;
  pausedAt: number;
  offsetMs: number;
  streams: MediaStream[];
  camRecorder: MediaRecorder | null;
  screenRecorder: MediaRecorder | null;
  camChunks: Blob[];
  screenChunks: Blob[];
  uploader: CaptureUploader | null;
  videoEl: HTMLVideoElement | null;
  screenStream: MediaStream | null;
  screenVideoEl: HTMLVideoElement | null;
}

interface Store {
  entries: Map<string, Entry>;
  listeners: Set<() => void>;
  version: number;
}

/**
 * Motor de grabación a nivel de módulo (fuera de React): la grabación sigue
 * activa aunque el usuario navegue a otra página (por ejemplo, a la simulación).
 */
const store: Store = ((globalThis as any).__pnCaptureEngine ??= {
  entries: new Map<string, Entry>(),
  listeners: new Set<() => void>(),
  version: 0,
}) as Store;

function emit() {
  store.version += 1;
  store.listeners.forEach((l) => l());
}

export function captureKey(captureSessionId: string, participantId?: string | null) {
  return `${captureSessionId}::${participantId ?? "host"}`;
}

function getEntry(key: string, label = ""): Entry {
  let e = store.entries.get(key);
  if (!e) {
    e = {
      key,
      label,
      phase: "idle",
      previewOn: false,
      startedAt: 0,
      pausedMs: 0,
      pausedAt: 0,
      offsetMs: 0,
      streams: [],
      camRecorder: null,
      screenRecorder: null,
      camChunks: [],
      screenChunks: [],
      uploader: null,
      videoEl: null,
      screenStream: null,
      screenVideoEl: null,
    };
    store.entries.set(key, e);
  }
  if (label) e.label = label;
  return e;
}

export function getPhase(key: string): CapturePhase {
  return store.entries.get(key)?.phase ?? "idle";
}

export function isPreviewOn(key: string): boolean {
  return store.entries.get(key)?.previewOn ?? false;
}

export function isScreenSharing(key: string): boolean {
  const e = store.entries.get(key);
  return !!e?.screenStream?.getVideoTracks().some((t) => t.readyState === "live");
}

export function getElapsedSec(key: string): number {
  const e = store.entries.get(key);
  if (!e || !e.startedAt) return 0;
  const pausedExtra = e.pausedAt ? Date.now() - e.pausedAt : 0;
  return Math.max(0, (Date.now() - e.startedAt - e.pausedMs - pausedExtra) / 1000);
}

export function getActiveRecordings() {
  return [...store.entries.values()]
    .filter((e) => e.phase === "recording" || e.phase === "paused" || e.phase === "uploading")
    .map((e) => ({ key: e.key, label: e.label, phase: e.phase }));
}

/** Suscripción al estado global del motor (para hooks e indicadores). */
export function subscribeCapture(listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
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

async function attach(e: Entry, stream: MediaStream | null) {
  const el = e.videoEl;
  if (!el) return;
  el.srcObject = stream;
  if (!stream) return;
  el.muted = true;
  el.playsInline = true;
  try {
    await el.play();
  } catch {
    /* autoplay puede requerir gesto del usuario */
  }
}

/** Vincula (o desvincula) el elemento <video> visible actualmente. */
export function attachVideoElement(key: string, el: HTMLVideoElement | null) {
  const e = getEntry(key);
  e.videoEl = el;
  const live = e.streams.find((s) => s.getVideoTracks().some((t) => t.readyState === "live"));
  if (el && live) void attach(e, live);
}

async function attachScreen(e: Entry) {
  const el = e.screenVideoEl;
  if (!el) return;
  el.srcObject = e.screenStream;
  if (!e.screenStream) return;
  el.muted = true;
  el.playsInline = true;
  try {
    await el.play();
  } catch {
    /* autoplay puede requerir gesto del usuario */
  }
}

/** Vincula (o desvincula) el <video> que muestra la pantalla compartida. */
export function attachScreenElement(key: string, el: HTMLVideoElement | null) {
  const e = getEntry(key);
  e.screenVideoEl = el;
  if (el) void attachScreen(e);
}

export async function ensurePreview(
  key: string,
  selection?: MediaDeviceSelection | null,
  label?: string,
): Promise<MediaStream> {
  const e = getEntry(key, label);
  const existing = e.streams.find((s) => s.getVideoTracks().some((t) => t.readyState === "live"));
  if (existing) {
    await attach(e, existing);
    e.previewOn = true;
    emit();
    return existing;
  }
  const video: MediaTrackConstraints = selection?.videoDeviceId
    ? {
        deviceId: { exact: selection.videoDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" };
  const audio: MediaTrackConstraints = selection?.audioDeviceId
    ? {
        deviceId: { exact: selection.audioDeviceId },
        echoCancellation: true,
        noiseSuppression: true,
      }
    : { echoCancellation: true, noiseSuppression: true };
  const cam = await navigator.mediaDevices.getUserMedia({ video, audio });
  e.streams.push(cam);
  await attach(e, cam);
  e.previewOn = true;
  emit();
  return cam;
}

export function stopPreview(key: string) {
  const e = store.entries.get(key);
  if (!e || e.phase === "recording" || e.phase === "paused") return;
  e.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  e.streams = [];
  void attach(e, null);
  e.previewOn = false;
  emit();
}

export async function startRecording(key: string, opts: CaptureStartOptions, label?: string) {
  const e = getEntry(key, label);
  if (e.phase === "recording" || e.phase === "paused") return;
  installLifecycleGuards();
  const cam = await ensurePreview(key, opts.selection, label);
  const mime = pickMime();
  // Nueva toma: descartamos restos de una grabación anterior ya resuelta.
  await clearRecovery(key);

  e.camChunks = [];
  const rec = new MediaRecorder(cam, mime ? { mimeType: mime } : undefined);
  rec.ondataavailable = (ev) => {
    if (ev.data.size > 0) {
      e.camChunks.push(ev.data);
      void persistChunk(key, "camera", ev.data);
      void saveMeta(e, ev.data.type || mime);
    }
  };
  e.camRecorder = rec;

  if (opts.recordScreen) {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      e.streams.push(screen);
      e.screenStream = screen;
      void attachScreen(e);
      screen.getVideoTracks().forEach((t) => {
        t.addEventListener("ended", () => {
          e.screenStream = null;
          void attachScreen(e);
          emit();
        });
      });
      e.screenChunks = [];
      const srec = new MediaRecorder(screen, mime ? { mimeType: mime } : undefined);
      srec.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          e.screenChunks.push(ev.data);
          void persistChunk(key, "screen", ev.data);
        }
      };
      e.screenRecorder = srec;
      srec.start(2000);
    } catch {
      throw new Error("__screen_cancelled__");
    }
  }

  e.uploader = opts.uploader;
  e.offsetMs = opts.getGameOffsetMs?.() ?? 0;
  e.startedAt = Date.now();
  e.pausedMs = 0;
  e.pausedAt = 0;
  rec.start(2000);
  e.phase = "recording";
  void saveMeta(e, mime);
  emit();
}

function saveMeta(e: Entry, mimeType: string) {
  const [captureSessionId, participant] = e.key.split("::");
  return persistMeta({
    key: e.key,
    captureSessionId,
    participantId: participant === "host" ? null : participant,
    label: e.label,
    startedAt: e.startedAt,
    durationSec: getElapsedSec(e.key),
    offsetMs: e.offsetMs,
    mimeType: mimeType || "video/webm",
    updatedAt: Date.now(),
  });
}

/**
 * Reanudación tras recargar la página o perder la pestaña: recupera los
 * fragmentos guardados en IndexedDB y los sube como grabación de la sesión.
 */
export async function recoverRecording(key: string, uploader: CaptureUploader): Promise<boolean> {
  const meta = await getRecoverable(key);
  if (!meta) return false;
  const { camera, screen } = await loadRecoveredBlobs(key);
  const camBlob = new Blob(camera, { type: meta.mimeType || "video/webm" });
  if (camBlob.size < 2048) {
    await clearRecovery(key);
    return false;
  }
  const syncOffsetMs = Math.round(meta.offsetMs);
  const durationSec = Math.max(1, Math.round(meta.durationSec));
  await uploader({ blob: camBlob, kind: "camera", durationSec, syncOffsetMs });
  if (screen.length > 0) {
    const sBlob = new Blob(screen, { type: meta.mimeType || "video/webm" });
    if (sBlob.size > 2048)
      await uploader({ blob: sBlob, kind: "screen", durationSec, syncOffsetMs });
  }
  await clearRecovery(key);
  return true;
}

/** Metadatos de una grabación interrumpida pendiente de recuperar. */
export async function pendingRecovery(key: string): Promise<RecoveryMeta | null> {
  if (getPhase(key) !== "idle") return null;
  return getRecoverable(key);
}

export async function discardRecovery(key: string) {
  await clearRecovery(key);
}

/**
 * Guardas de ciclo de vida: avisan antes de recargar/cerrar con una grabación en
 * marcha y reanudan el recorder y la vista previa si el navegador los pausó al
 * perder el foco (habitual en móvil al cambiar de app).
 */
function installLifecycleGuards() {
  const g = globalThis as any;
  if (typeof window === "undefined" || g.__pnCaptureGuards) return;
  g.__pnCaptureGuards = true;

  window.addEventListener("beforeunload", (ev: BeforeUnloadEvent) => {
    const active = [...store.entries.values()].some(
      (e) => e.phase === "recording" || e.phase === "paused" || e.phase === "uploading",
    );
    if (!active) return;
    ev.preventDefault();
    ev.returnValue = "";
  });

  const revive = () => {
    if (document.visibilityState !== "visible") return;
    store.entries.forEach((e) => {
      if (e.phase !== "recording") return;
      [e.camRecorder, e.screenRecorder].forEach((r) => {
        if (r && r.state === "paused") {
          try {
            r.resume();
          } catch {
            /* ignore */
          }
        }
      });
      const live = e.streams.find((s) => s.getVideoTracks().some((t) => t.readyState === "live"));
      if (live) void attach(e, live);
    });
    emit();
  };

  document.addEventListener("visibilitychange", revive);
  window.addEventListener("focus", revive);
  window.addEventListener("pageshow", revive);
}


export function pauseRecording(key: string) {
  const e = store.entries.get(key);
  if (!e || e.phase !== "recording") return;
  [e.camRecorder, e.screenRecorder].forEach((r) => {
    if (r && r.state === "recording") r.pause();
  });
  e.pausedAt = Date.now();
  e.phase = "paused";
  emit();
}

export function resumeRecording(key: string) {
  const e = store.entries.get(key);
  if (!e || e.phase !== "paused") return;
  if (e.pausedAt) e.pausedMs += Date.now() - e.pausedAt;
  e.pausedAt = 0;
  [e.camRecorder, e.screenRecorder].forEach((r) => {
    if (r && r.state === "paused") r.resume();
  });
  e.phase = "recording";
  emit();
}

/** Detiene, sube las pistas y limpia. Devuelve true si se guardó algo. */
export async function stopRecording(key: string): Promise<boolean> {
  const e = store.entries.get(key);
  if (!e || (e.phase !== "recording" && e.phase !== "paused")) return false;
  if (e.pausedAt) {
    e.pausedMs += Date.now() - e.pausedAt;
    e.pausedAt = 0;
  }
  const duration = (Date.now() - e.startedAt - e.pausedMs) / 1000;
  e.phase = "uploading";
  emit();

  try {
    const waitFor = (rec: MediaRecorder | null) =>
      new Promise<void>((resolve) => {
        if (!rec || rec.state === "inactive") return resolve();
        rec.onstop = () => resolve();
        rec.stop();
      });
    await Promise.all([waitFor(e.camRecorder), waitFor(e.screenRecorder)]);
    e.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    e.streams = [];
    void attach(e, null);
    e.screenStream = null;
    void attachScreen(e);
    e.previewOn = false;

    const camBlob = new Blob(e.camChunks, { type: e.camChunks[0]?.type || "video/webm" });
    if (camBlob.size < 2048) throw new Error("La grabación quedó vacía; inténtalo de nuevo.");
    const syncOffsetMs = Math.round(e.offsetMs);
    await e.uploader?.({ blob: camBlob, kind: "camera", durationSec: duration, syncOffsetMs });

    if (e.screenChunks.length > 0) {
      const sBlob = new Blob(e.screenChunks, { type: e.screenChunks[0]?.type || "video/webm" });
      if (sBlob.size > 2048)
        await e.uploader?.({ blob: sBlob, kind: "screen", durationSec: duration, syncOffsetMs });
    }
    await clearRecovery(key);
    return true;

  } finally {
    e.camChunks = [];
    e.screenChunks = [];
    e.camRecorder = null;
    e.screenRecorder = null;
    e.startedAt = 0;
    e.pausedMs = 0;
    e.phase = "idle";
    emit();
  }
}

/** Estado reactivo de una grabación concreta. */
export function useCaptureState(key: string) {
  const [, force] = useState(0);
  useEffect(() => subscribeCapture(() => force((n) => n + 1)), []);
  const phase = getPhase(key);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(getElapsedSec(key));
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed(getElapsedSec(key)), 500);
    return () => clearInterval(t);
  }, [key, phase]);
  return { phase, previewOn: isPreviewOn(key), elapsed, screenSharing: isScreenSharing(key) };
}

/** Lista reactiva de grabaciones activas (para el indicador global). */
export function useActiveRecordings() {
  const [, force] = useState(0);
  useEffect(() => subscribeCapture(() => force((n) => n + 1)), []);
  return getActiveRecordings();
}
