import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, Mic, MicOff, Minus, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type AvatarFrame, AlphaVideoCanvas } from "@/components/assistant/AlphaVideoCanvas";
import { type HelpTopic, localAnswerFor, screenName, topicsForPath } from "@/lib/assistant-help";
import { askAssistant } from "@/lib/assistant.functions";
import { assistantPrepareVoice, assistantSpeech, assistantTranscribe } from "@/lib/assistant-voice.functions";
import {
  brightnessFromSamples,
  envelopeFromSamples,
  opennessAt,
  syntheticOpenness,
  syntheticWide,
  opennessFromEnergy,
  planTalkTimeline,
  talkRate,
  TALK_LOOP,
  talkFaceOn,
  wideAt,
} from "@/lib/assistant-lipsync";
import { splitForSpeech } from "@/lib/assistant-speech";
import { TALK_FOOTAGE, TALK_LOOP_SECONDS } from "@/lib/assistant-talk-footage";
import { readPreferredAiModel } from "@/lib/preferred-model";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "assistant"; text: string; link?: HelpTopic["link"]; details?: string[] };
type AvatarState = "idle" | "talking" | "greeting";
type Saved = { right: number; bottom: number; collapsed: boolean; voiceOn: boolean; greeted: boolean };

const STORAGE_KEY = "xandralyze.assistant.v1";
const GREETING =
  "Hola, soy tu asistente. Pregúntame lo que necesites sobre la aplicación y te lo explico paso a paso. Si te molesto, arrástrame a otro sitio o minimízame.";
const FIG_RATIO = 382 / 480;
const PANEL_W = 360;
const BUBBLE = 60;
const MAX_RECORD_MS = 30_000;
/** Cada cuánto se transcribe lo grabado hasta ahora para irlo escribiendo. */
const LIVE_TRANSCRIBE_MS = 2200;
/** El saludo suena solo la primera vez que se abre en cada visita. */
const GREETED_KEY = "xandralyze-assistant-greeted";
const GREETING_VIDEO = "/assistant/saludo-alfa.mp4";
/** Muestra de la voz del saludo para copiarla en el ElevenLabs del usuario. */
const VOICE_SAMPLE = "/assistant/voz-muestra.mp3";
const VOICE_KEY = "xandralyze-assistant-voice";
/** Un instante de silencio: desbloquea el audio en iPhone dentro del toque. */
const SILENT_WAV = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

type Clip = { url: string; env: Float32Array | null; shape: Float32Array | null };
type Lip =
  | { mode: "audio"; env: Float32Array | null; shape: Float32Array | null; plan: Float32Array | null }
  | { mode: "browser"; start: number; wordAt: number; wordLen: number };

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** decodeAudioData con promesa o con callbacks (Safari antiguo). */
function decodeAudio(ctx: BaseAudioContext, buf: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(buf, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const spain = es.filter((v) => v.lang.toLowerCase() === "es-es");
  const female = /m[oó]nica|helena|laura|elvira|luc[ií]a|paulina|marisol|female|mujer|google español$/i;
  return spain.find((v) => female.test(v.name)) ?? spain[0] ?? es.find((v) => female.test(v.name)) ?? es[0] ?? null;
}

function readSaved(): Saved {
  // En el móvil empieza por encima de la barra de navegación inferior.
  const bottom = window.innerWidth < 640 ? 76 : 16;
  const base: Saved = { right: 16, bottom, collapsed: false, voiceOn: true, greeted: false };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return raw && typeof raw === "object" ? { ...base, ...raw } : base;
  } catch {
    return base;
  }
}

function useViewport() {
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/**
 * Asistente personal de la app: la mujer de los vídeos, sin fondo, flotando
 * sobre la pantalla. Se arrastra a cualquier sitio (lo recuerda), se minimiza a
 * una burbuja y abre un chat con ayuda de la app, voz y micrófono. Las
 * preguntas libres las responde la IA del propio usuario.
 */
export function AssistantAvatarWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const vp = useViewport();
  const mobile = vp.w < 640;
  const figW = mobile ? 112 : 150;
  const figH = Math.round(figW * FIG_RATIO);

  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState({ right: 16, bottom: 16 });
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [greeted, setGreeted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, from: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [avatar, setAvatar] = useState<AvatarState>("idle");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [preparingVoice, setPreparingVoice] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [dragging, setDragging] = useState(false);

  const idleRef = useRef<HTMLVideoElement>(null);
  const greetRef = useRef<HTMLVideoElement>(null);
  const talkRef = useRef<HTMLVideoElement>(null);
  const lastVoiceAt = useRef(0);
  const avatarRef = useRef<AvatarState>("idle");
  avatarRef.current = avatar;
  const voiceOnRef = useRef(true);
  voiceOnRef.current = voiceOn;
  const recRef = useRef<any>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const webSpeechBroken = useRef(false);
  const recSession = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null);
  // Voz: un único reproductor de audio (desbloqueado en el primer toque, así
  // también suena en iPhone) y el volumen de cada respuesta para mover la boca.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlocked = useRef(false);
  const speechPrimed = useRef(false);
  const decodeCtx = useRef<BaseAudioContext | null>(null);
  const clipCache = useRef(new Map<string, Clip>());
  const clipPending = useRef(new Map<string, Promise<Clip | null>>());
  const ttsFailures = useRef(0);
  const ttsUnavailable = useRef(false);
  const speakToken = useRef(0);
  const lipRef = useRef<Lip | null>(null);
  const sendTextRef = useRef<(t: string) => void>(() => {});
  const ask = useServerFn(askAssistant);
  const speech = useServerFn(assistantSpeech);
  const prepareVoice = useServerFn(assistantPrepareVoice);
  const voicePrep = useRef<Promise<string | null> | null>(null);
  const transcribe = useServerFn(assistantTranscribe);

  // Restaurar posición y preferencias guardadas.
  useEffect(() => {
    const s = readSaved();
    setPos({ right: s.right, bottom: s.bottom });
    setCollapsed(s.collapsed);
    setVoiceOn(s.voiceOn);
    try {
      setGreeted(sessionStorage.getItem(GREETED_KEY) === "1");
    } catch {
      setGreeted(false);
    }
    const w = window as any;
    const canRecord = Boolean(navigator.mediaDevices?.getUserMedia) && typeof w.MediaRecorder !== "undefined";
    setMicSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition) || canRecord);
    window.speechSynthesis?.getVoices();
    setReady(true);
    const cache = clipCache.current;
    return () => {
      recRef.current?.stop?.();
      if (mediaRecRef.current?.state === "recording") mediaRecRef.current.stop();
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      cache.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...pos, collapsed, voiceOn }));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [ready, pos, collapsed, voiceOn]);

  const boxW = collapsed ? BUBBLE : figW;
  const boxH = collapsed ? BUBBLE : figH;
  const clamp = useCallback(
    (p: { right: number; bottom: number }) => ({
      right: Math.round(Math.min(Math.max(4, p.right), Math.max(4, vp.w - boxW - 4))),
      bottom: Math.round(Math.min(Math.max(4, p.bottom), Math.max(4, vp.h - boxH - 4))),
    }),
    [vp.w, vp.h, boxW, boxH],
  );
  const shown = clamp(pos);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, open, preparingVoice]);

  // Al abrir el chat se preparan las primeras frases de las explicaciones de esta pantalla.
  useEffect(() => {
    if (!open || !ready) return;
    const t = window.setTimeout(() => topicsForPath(pathname).slice(0, 3).forEach((tp) => !tp.video && prefetchSpeech(tp.answer)), 600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.setAttribute("playsinline", "");
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  };

  /** Se llama dentro de cada toque: el iPhone solo deja sonar audio así. */
  const unlockAudio = () => {
    try {
      const nav = navigator as any;
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* no disponible */
    }
    const a = ensureAudio();
    if (!audioUnlocked.current && a.paused) {
      a.src = SILENT_WAV;
      a.play()
        .then(() => {
          audioUnlocked.current = true;
        })
        .catch(() => {});
    }
    if (window.speechSynthesis && !speechPrimed.current) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      speechPrimed.current = true;
    }
  };

  const stopSpeaking = useCallback(() => {
    speakToken.current++;
    window.speechSynthesis?.cancel();
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    const g = greetRef.current;
    if (g && !g.paused) g.pause();
    lipRef.current = null;
    setPreparingVoice(false);
    setAvatar("idle");
  }, []);

  const speakWithBrowser = (text: string, token: number) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickSpanishVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "es-ES";
    u.rate = 1.05;
    const lip: Lip = { mode: "browser", start: performance.now(), wordAt: 0, wordLen: 0 };
    u.onstart = () => {
      if (token !== speakToken.current) return;
      lip.start = performance.now();
      lipRef.current = lip;
      setAvatar("talking");
    };
    u.onboundary = (e) => {
      lip.wordAt = performance.now();
      lip.wordLen = Math.max(2, (e as SpeechSynthesisEvent & { charLength?: number }).charLength ?? 5);
    };
    const end = () => {
      if (token !== speakToken.current) return;
      lipRef.current = null;
      setAvatar("idle");
    };
    u.onend = end;
    u.onerror = end;
    window.speechSynthesis.speak(u);
  };

  /**
   * La misma voz del saludo, copiada una sola vez en tu cuenta de ElevenLabs.
   * Se comprueba una vez por visita; null = sin ElevenLabs o su plan no lo permite.
   */
  const ensureVoice = (): Promise<string | null> => {
    voicePrep.current ??= (async () => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(VOICE_KEY) ?? "null");
        if (saved && "voiceId" in saved) return saved.voiceId as string | null;
      } catch {
        /* almacenamiento no disponible */
      }
      let voiceId: string | null = null;
      try {
        let r = await prepareVoice({ data: {} });
        if (r.state === "needs-sample") {
          const blob = await (await fetch(VOICE_SAMPLE)).blob();
          r = await prepareVoice({ data: { sample: await blobToBase64(blob) } });
        }
        if (r.state === "ready") voiceId = r.voiceId;
        else if (r.state === "unavailable") console.warn("[asistente] voz del saludo no disponible:", r.message);
      } catch (e) {
        console.warn("[asistente] no he podido preparar la voz del saludo", e);
        voicePrep.current = null; // se reintenta en el siguiente mensaje
        return null;
      }
      try {
        sessionStorage.setItem(VOICE_KEY, JSON.stringify({ voiceId }));
      } catch {
        /* almacenamiento no disponible */
      }
      return voiceId;
    })();
    return voicePrep.current;
  };

  /** Voz natural con tus claves (voz del saludo, OpenAI o ElevenLabs); null = usar la del navegador. */
  const loadClip = (text: string): Promise<Clip | null> => {
    const cached = clipCache.current.get(text);
    if (cached) return Promise.resolve(cached);
    if (ttsUnavailable.current) return Promise.resolve(null);
    const pending = clipPending.current.get(text);
    if (pending) return pending;
    const job = (async (): Promise<Clip | null> => {
      try {
        const voiceId = await ensureVoice();
        const r = await speech({ data: voiceId ? { text, voiceId } : { text } });
        if (!r.ok) {
          if (r.reason === "no-keys" || ++ttsFailures.current >= 2) ttsUnavailable.current = true;
          return null;
        }
        ttsFailures.current = 0;
        const bytes = base64ToBytes(r.audio);
        const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
        let env: Float32Array | null = null;
        let shape: Float32Array | null = null;
        try {
          const w = window as any;
          decodeCtx.current ??= new (w.OfflineAudioContext || w.webkitOfflineAudioContext)(1, 1, 44100);
          const decoded = await decodeAudio(decodeCtx.current!, bytes.buffer.slice(0) as ArrayBuffer);
          const samples = decoded.getChannelData(0);
          env = envelopeFromSamples(samples, decoded.sampleRate);
          shape = brightnessFromSamples(samples, decoded.sampleRate);
        } catch {
          env = null; // la boca se moverá igualmente mientras suene
        }
        const clip = { url, env, shape };
        clipCache.current.set(text, clip);
        return clip;
      } catch {
        if (++ttsFailures.current >= 2) ttsUnavailable.current = true;
        return null;
      } finally {
        clipPending.current.delete(text);
      }
    })();
    clipPending.current.set(text, job);
    return job;
  };

  /** Prepara de antemano la primera frase de una respuesta para que suene al momento. */
  const prefetchSpeech = (text: string) => {
    if (!voiceOnRef.current || ttsUnavailable.current) return;
    const first = splitForSpeech(text)[0];
    if (first) void loadClip(first);
  };

  /** Reproduce una parte; true si terminó bien. */
  const playClip = (clip: Clip, token: number) =>
    new Promise<boolean>((resolve) => {
      const a = ensureAudio();
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.src = clip.url;
      // Plan para que la cara grabada abra la boca en las sílabas de esta frase.
      let plan: Float32Array | null = null;
      if (clip.env) {
        try {
          const open = Array.from(clip.env, (e) => opennessFromEnergy(e));
          plan = planTalkTimeline(open, TALK_FOOTAGE, talkRef.current?.currentTime ?? 0);
        } catch {
          plan = null;
        }
      }
      lipRef.current = { mode: "audio", env: clip.env, shape: clip.shape, plan };
      a.play()
        .then(() => {
          audioUnlocked.current = true;
          if (token === speakToken.current) setAvatar("talking");
        })
        .catch(() => resolve(false));
    });

  const speak = async (text: string) => {
    if (!voiceOnRef.current) return;
    const token = ++speakToken.current;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    const parts = splitForSpeech(text);
    if (parts.length === 0) return;
    const stillMine = () => token === speakToken.current && voiceOnRef.current;
    const first = loadClip(parts[0]);
    // Mientras se prepara la primera frase se piden ya las siguientes.
    if (parts[1]) void loadClip(parts[1]);
    if (!clipCache.current.has(parts[0])) setPreparingVoice(true);
    let clip = await first;
    if (token === speakToken.current) setPreparingVoice(false);
    for (let i = 0; i < parts.length; i++) {
      if (!stillMine()) return;
      if (!clip) {
        speakWithBrowser(parts.slice(i).join(" "), token);
        return;
      }
      if (parts[i + 2]) void loadClip(parts[i + 2]);
      const ok = await playClip(clip, token);
      if (!stillMine()) return;
      if (!ok) {
        speakWithBrowser(parts.slice(i).join(" "), token);
        return;
      }
      if (i + 1 < parts.length) {
        lipRef.current = null; // boca cerrada mientras llega la siguiente frase
        clip = await loadClip(parts[i + 1]);
      }
    }
    if (token !== speakToken.current) return;
    lipRef.current = null;
    setAvatar("idle");
  };

  /** Cuánto abre la boca ahora mismo (0–1) según lo que suena. */
  const mouthOpen = () => {
    const lip = lipRef.current;
    const now = performance.now();
    if (lip?.mode === "audio") {
      const a = audioRef.current;
      if (!a || a.paused) return 0;
      return lip.env ? opennessAt(lip.env, a.currentTime + 0.04) : syntheticOpenness(now);
    }
    if (lip?.mode === "browser") {
      // Con avisos de palabra solo mueve la boca durante cada palabra.
      const wordMs = lip.wordLen * 70 + 60;
      const inWord = lip.wordAt === 0 ? true : now - lip.wordAt < wordMs;
      return inWord ? syntheticOpenness(now - lip.start) : 0;
    }
    return 0;
  };

  /** Forma de la boca ahora mismo (−1 redonda … 1 estirada). */
  const mouthWide = () => {
    const lip = lipRef.current;
    const now = performance.now();
    if (lip?.mode === "audio") {
      const a = audioRef.current;
      if (!a || a.paused) return 0;
      return lip.env ? wideAt(lip.shape, a.currentTime + 0.04) : syntheticWide(now);
    }
    if (lip?.mode === "browser") return syntheticWide(now - lip.start);
    return 0;
  };

  /** Reproduce un vídeo grabado (saludo o respuesta de un tema) encima de la espera. */
  const playRecorded = (src: string, onFail?: () => void) => {
    const g = greetRef.current;
    if (!g) return onFail?.();
    unlockAudio();
    stopSpeaking();
    if (!g.currentSrc.endsWith(src)) {
      g.src = src;
      g.load();
    } else g.currentTime = 0;
    g.muted = !voiceOnRef.current;
    setAvatar("greeting");
    g.play().catch(() => {
      setAvatar("idle");
      onFail?.();
    });
  };

  const playGreeting = () => {
    setGreeted(true);
    try {
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      /* almacenamiento no disponible */
    }
    playRecorded(GREETING_VIDEO);
  };

  const pushAssistant = (text: string, link?: HelpTopic["link"], video?: string, details?: string[]) => {
    setMessages((m) => [...m, { id: nextId.current++, from: "assistant", text, link, details }]);
    if (video) playRecorded(video, () => void speak(text));
    else void speak(text);
  };

  const answerTopic = (topic: HelpTopic) => {
    unlockAudio();
    stopSpeaking();
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text: topic.question }]);
    pushAssistant(topic.answer, topic.link, topic.video, topic.details);
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    unlockAudio();
    stopSpeaking();
    const history = messages.slice(1).slice(-6).map(({ from, text: t }) => ({ from, text: t }));
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text }]);
    setInput("");
    const topic = localAnswerFor(text);
    if (topic) {
      pushAssistant(topic.answer, topic.link, topic.video, topic.details);
      return;
    }
    setThinking(true);
    try {
      const res = await ask({
        data: { question: text, screen: screenName(pathname), history, model: readPreferredAiModel() ?? undefined },
      });
      if (res.ok) pushAssistant(res.answer);
      else
        pushAssistant(
          res.message,
          res.reason === "no-keys" ? { to: "/app/settings", label: "Ir a Ajustes" } : { to: "/app/ai-test", label: "Abrir Probar IA" },
        );
    } catch {
      pushAssistant("No he podido conectar ahora mismo. Revisa tu conexión y vuelve a intentarlo.");
    } finally {
      setThinking(false);
    }
  };
  sendTextRef.current = (t: string) => void sendText(t);

  /** Graba y transcribe con tus claves: para Firefox y navegadores sin dictado. */
  const startRecording = async () => {
    const w = window as any;
    if (!navigator.mediaDevices?.getUserMedia || typeof w.MediaRecorder === "undefined") {
      pushAssistant("Este navegador no me deja usar el micrófono. Escríbeme la pregunta o prueba con Chrome, Edge o Safari.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      pushAssistant(
        "No tengo permiso para usar el micrófono. Pulsa el icono del candado o del micrófono junto a la dirección de la página, permite el micrófono y vuelve a pulsar el botón.",
      );
      return;
    }
    const types = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
    const mime = types.find((t) => w.MediaRecorder.isTypeSupported?.(t));
    const mr: MediaRecorder = new w.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const type = mr.mimeType || mime || "audio/webm";
    const session = ++recSession.current;
    mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    const timer = window.setTimeout(() => mr.state === "recording" && mr.stop(), MAX_RECORD_MS);
    // Mientras hablas, se transcribe lo grabado hasta ahora y se va escribiendo.
    let liveBusy = false;
    let liveSize = 0;
    const live = window.setInterval(async () => {
      if (liveBusy || mr.state !== "recording" || chunks.length === liveSize) return;
      const blob = new Blob(chunks, { type });
      if (blob.size < 4000) return;
      liveBusy = true;
      liveSize = chunks.length;
      try {
        const r = await transcribe({ data: { audio: await blobToBase64(blob), mime: type } });
        if (r.ok && r.text && session === recSession.current && mr.state === "recording") setInput(r.text);
      } catch {
        /* el texto final llega al terminar */
      } finally {
        liveBusy = false;
      }
    }, LIVE_TRANSCRIBE_MS);
    mr.onstop = async () => {
      window.clearTimeout(timer);
      window.clearInterval(live);
      recSession.current++;
      stream.getTracks().forEach((t) => t.stop());
      mediaRecRef.current = null;
      setListening(false);
      const blob = new Blob(chunks, { type });
      if (blob.size < 1200) {
        setInput("");
        return;
      }
      setTranscribing(true);
      try {
        const audio = await blobToBase64(blob);
        const r = await transcribe({ data: { audio, mime: blob.type } });
        if (r.ok && r.text) {
          setInput(r.text);
          sendTextRef.current(r.text);
        }
        else if (r.ok) pushAssistant("No he oído nada. Acércate un poco al micrófono y vuelve a probar.");
        else pushAssistant(r.message, r.reason === "no-keys" ? { to: "/app/settings", label: "Ir a Ajustes" } : undefined);
      } catch {
        pushAssistant("No he podido transcribir la grabación. Revisa tu conexión y vuelve a intentarlo.");
      } finally {
        setTranscribing(false);
      }
    };
    mediaRecRef.current = mr;
    setInput("");
    // Trozos de 1 s: así se puede transcribir lo grabado sin parar la grabación.
    mr.start(1000);
    setListening(true);
  };

  const toggleMic = () => {
    unlockAudio();
    if (listening) {
      recRef.current?.stop();
      if (mediaRecRef.current?.state === "recording") mediaRecRef.current.stop();
      return;
    }
    if (transcribing) return;
    stopSpeaking();
    const w = window as any;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec || webSpeechBroken.current) {
      void startRecording();
      return;
    }
    const rec = new Rec();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    let fallback = false;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = String(e.results[i][0].transcript ?? "");
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      // Si el dictado del navegador no está disponible, grabamos y transcribimos.
      if (["service-not-allowed", "network", "language-not-supported", "audio-capture"].includes(e?.error)) {
        webSpeechBroken.current = true;
        fallback = true;
      } else if (e?.error === "not-allowed") {
        pushAssistant(
          "No tengo permiso para usar el micrófono. Pulsa el icono del candado junto a la dirección de la página, permite el micrófono y vuelve a pulsar el botón.",
        );
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      if (fallback) void startRecording();
      else if (finalText.trim()) sendTextRef.current(finalText);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      webSpeechBroken.current = true;
      void startRecording();
    }
  };

  const toggleVoice = () => {
    if (voiceOn) stopSpeaking();
    else unlockAudio();
    setVoiceOn((v) => !v);
  };

  const minimize = () => {
    stopSpeaking();
    setOpen(false);
    setCollapsed(true);
  };

  // --- Arrastrar ---------------------------------------------------------
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ...shown, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setPos(clamp({ right: d.right - dx, bottom: d.bottom - dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.moved) {
      unlockAudio();
      const opening = collapsed || !open;
      if (collapsed) {
        setCollapsed(false);
        setOpen(true);
      } else setOpen((o) => !o);
      // La primera vez que la abres en cada visita te saluda (dentro del toque, para que suene también en iPhone).
      if (opening && !greeted) playGreeting();
    }
  };
  const onKeyMove = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 60 : 20;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setPos(clamp({ right: shown.right + m[0], bottom: shown.bottom + m[1] }));
  };

  if (!ready) return null;

  const activeFrame = (): AvatarFrame => {
    const a = avatarRef.current;
    const now = performance.now();
    const open = a === "talking" ? mouthOpen() : null;
    if (open !== null && open > 0.05) lastVoiceAt.current = now;
    else if (a !== "talking") lastVoiceAt.current = 0;
    // La cara grabada sigue el plan: acelera o frena para ir con las palabras.
    const talk = talkRef.current;
    const lip = lipRef.current;
    const au = audioRef.current;
    if (talk) {
      let rate = 1;
      if (a === "talking" && lip?.mode === "audio" && lip.plan && au && !au.paused && !talk.paused) {
        const r = talkRate(lip.plan, au.currentTime + 0.04, talk.currentTime, TALK_LOOP_SECONDS);
        if (r.seek !== null) talk.currentTime = r.seek;
        rate = r.rate;
      }
      if (Math.abs(talk.playbackRate - rate) > 0.05) talk.playbackRate = rate;
    }
    return {
      talk: talkRef.current,
      talkOn: a === "talking" && talkFaceOn(lastVoiceAt.current, now),
      idle: idleRef.current,
      greet: greetRef.current,
      greeting: a === "greeting",
      mouthOpen: open,
      mouthWide: a === "talking" ? mouthWide() : 0,
    };
  };

  const status = listening
    ? "Te escucho…"
    : transcribing
      ? "Transcribiendo…"
      : thinking
        ? "Pensando…"
        : preparingVoice
          ? "Preparando la voz…"
          : avatar !== "idle"
            ? "Hablando"
            : "Disponible";
  const topics = topicsForPath(pathname);
  const dragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (collapsed) {
          setCollapsed(false);
          setOpen(true);
        } else setOpen((o) => !o);
      } else onKeyMove(e);
    },
  };

  const figure = (w: number) => (
    <AlphaVideoCanvas
      getFrame={activeFrame}
      fallbackSrc="/assistant/figura.png"
      className="pointer-events-none block h-full w-full select-none drop-shadow-[0_10px_18px_rgba(15,23,42,0.28)]"
      width={480}
      height={382}
      key={w}
    />
  );

  // Panel: al lado de la figura en ordenador, como hoja inferior en el móvil.
  const figLeft = vp.w - shown.right - figW;
  const panelOnLeft = figLeft >= PANEL_W + 12;
  const panelBottom = Math.min(shown.bottom, Math.max(8, vp.h - 8 - 520));
  const panelStyle: React.CSSProperties = mobile
    ? {}
    : {
        bottom: panelBottom,
        maxHeight: vp.h - panelBottom - 8,
        width: PANEL_W,
        ...(panelOnLeft
          ? { right: shown.right + figW + 8 }
          : { right: Math.max(8, shown.right - PANEL_W - 8) }),
      };

  return (
    <>
      {/* Vídeos fuente (ocultos): el lienzo pinta el que toque sin fondo. */}
      <div aria-hidden className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0">
        {!collapsed && <video ref={idleRef} src="/assistant/escuchando-alfa.mp4" autoPlay loop muted playsInline preload="auto" />}
        {/* Siempre montado: así el saludo puede empezar dentro del mismo toque que abre el asistente. */}
        <video ref={greetRef} src={GREETING_VIDEO} playsInline preload="auto" onEnded={() => setAvatar("idle")} />
        {/* Su cara hablando (del propio saludo, sin sonido): se funde encima mientras suena la voz. */}
        {!collapsed && <video ref={talkRef} src={TALK_LOOP} loop muted playsInline preload="auto" />}
      </div>

      {collapsed ? (
        <button
          type="button"
          {...dragProps}
          aria-label="Abrir asistente (arrastra para moverlo)"
          title="Pulsa para abrir · arrastra para mover"
          style={{ right: shown.right, bottom: shown.bottom, width: BUBBLE, height: BUBBLE }}
          className={cn(
            "fixed z-50 touch-none overflow-hidden rounded-full border-2 border-primary shadow-lg ring-4 ring-primary/20 transition-transform",
            dragging ? "cursor-grabbing scale-105" : "cursor-grab hover:scale-105",
          )}
        >
          <img src="/assistant/poster.jpg" alt="" draggable={false} className="pointer-events-none h-full w-full scale-150 object-cover object-[50%_35%]" />
          <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-card bg-success" />
        </button>
      ) : (
        !(mobile && open) && (
          <div
            className="group fixed z-50"
            style={{ right: shown.right, bottom: shown.bottom, width: figW, height: figH }}
          >
            <div
              role="button"
              tabIndex={0}
              {...dragProps}
              aria-label={open ? "Cerrar chat del asistente (arrastra para moverla)" : "Abrir asistente (arrastra para moverla)"}
              aria-expanded={open}
              title="Pulsa para hablar conmigo · arrastra para moverme"
              className={cn(
                "h-full w-full touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
            >
              {figure(figW)}
            </div>
            {!open && !dragging && (
              <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                ¿Te ayudo?
              </span>
            )}
            <button
              type="button"
              onClick={minimize}
              aria-label="Minimizar asistente"
              title="Minimizar"
              className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-full border bg-card text-foreground opacity-0 shadow transition-opacity hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        )
      )}

      {open && !collapsed && (
        <section
          aria-label="Asistente de Xandralyze"
          style={panelStyle}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
            mobile ? "inset-x-0 bottom-0 max-h-[78dvh] rounded-t-2xl" : "rounded-2xl",
          )}
        >
          <header className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2">
            {mobile && (
              <div className="-my-2 -ml-1 shrink-0" style={{ width: 84, height: Math.round(84 * FIG_RATIO) }}>
                {figure(84)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Tu asistente</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full bg-success", (avatar !== "idle" || listening || thinking || transcribing || preparingVoice) && "animate-pulse")} />
                {status} · {screenName(pathname)}
              </div>
            </div>
            <button type="button" onClick={toggleVoice} aria-label={voiceOn ? "Silenciar voz" : "Activar voz"} title={voiceOn ? "Silenciar voz" : "Activar voz"} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button type="button" onClick={minimize} aria-label="Minimizar asistente" title="Minimizar" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => { stopSpeaking(); setOpen(false); }} aria-label="Cerrar chat" title="Cerrar chat" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex min-h-[140px] flex-1 flex-col gap-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.from === "user" ? "self-end rounded-br-sm bg-primary text-primary-foreground" : "self-start rounded-bl-sm bg-muted text-foreground",
                )}
              >
                {m.text}
                {m.details && m.details.length > 0 && (
                  <div className="mt-2 border-t border-border pt-2">
                    <p className="text-xs font-semibold">Paso a paso</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs">
                      {m.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {m.link && (
                  <Link
                    to={m.link.to}
                    onClick={() => mobile && setOpen(false)}
                    className="mt-2 flex w-fit items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {m.link.label} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {m.id === 0 && (
                  <button
                    type="button"
                    onClick={playGreeting}
                    className="mt-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent"
                  >
                    <Play className="h-3 w-3" /> {greeted ? "Repetir saludo" : "Escuchar saludo"}
                  </button>
                )}
              </div>
            ))}
            {preparingVoice && !thinking && (
              <div role="status" className="flex items-center gap-1.5 self-start px-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Preparando la voz…
              </div>
            )}
            {thinking && <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">Pensando…</div>}
          </div>

          <div className="shrink-0 border-t px-3 pt-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Te puedo explicar</div>
            <div className="flex max-h-[76px] flex-wrap gap-1.5 overflow-y-auto pb-2">
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => answerTopic(t)}
                  onPointerEnter={() => !t.video && prefetchSpeech(t.answer)}
                  onFocus={() => !t.video && prefetchSpeech(t.answer)}
                  className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-accent"
                >
                  {t.question}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendText(input);
            }}
            className="flex shrink-0 items-center gap-2 border-t p-3"
          >
            {micSupported && (
              <Button type="button" size="icon" variant={listening ? "destructive" : "outline"} onClick={toggleMic} disabled={transcribing} aria-label={listening ? "Parar micrófono" : "Hablar"} aria-pressed={listening}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Te escucho… pulsa el micro para terminar" : transcribing ? "Transcribiendo…" : "Pregunta lo que quieras"}
              aria-label="Tu pregunta"
              className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || thinking} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
