import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PictureInPicture2, X } from "lucide-react";

type Corner = "br" | "bl" | "tr" | "tl";
type PipSize = "sm" | "md" | "lg";

interface Props {
  src: string;
  /** Duración conocida (segundos) para mostrarla mientras el navegador la calcula. */
  durationSec?: number | null;
  /** Pista secundaria (cámara) para mostrarla en un recuadro sobre la principal. */
  pipSrc?: string | null;
  /** Desfase de la pista PIP respecto a la principal, en milisegundos. */
  pipOffsetMs?: number;
  /** Etiqueta del recuadro. */
  pipLabel?: string;
  /** Identificador para recordar posición/tamaño del recuadro (p. ej. id de sesión). */
  pipPrefsKey?: string;
}

const CORNER_CLASS: Record<Corner, string> = {
  br: "bottom-14 right-3",
  bl: "bottom-14 left-3",
  tr: "top-3 right-3",
  tl: "top-3 left-3",
};

const SIZE_CLASS: Record<PipSize, string> = {
  sm: "w-1/6 min-w-[90px] max-w-[150px]",
  md: "w-1/4 min-w-[110px] max-w-[220px]",
  lg: "w-1/3 min-w-[150px] max-w-[320px]",
};

const SIZE_LABEL: Record<PipSize, string> = { sm: "S", md: "M", lg: "L" };
const SIZES: PipSize[] = ["sm", "md", "lg"];

type AudioSource = "main" | "pip";
type PipPrefs = { corner: Corner; size: PipSize; on: boolean; audio?: AudioSource; trimMs?: number };

function prefsStorageKey(key?: string) {
  return `playnalyze:pip:${key ?? "default"}`;
}

function loadPipPrefs(key?: string): Partial<PipPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(prefsStorageKey(key));
    return raw ? (JSON.parse(raw) as Partial<PipPrefs>) : {};
  } catch {
    return {};
  }
}

/** Umbrales de deriva: por debajo se corrige suavemente con la velocidad. */
const SOFT_DRIFT = 0.04; // 40 ms: imperceptible, no tocamos nada
const HARD_DRIFT = 0.35; // 350 ms: salto duro



/**
 * Reproductor de grabaciones MediaRecorder (WebM). Los archivos generados por
 * MediaRecorder no llevan duración en la cabecera, así que Chrome devuelve
 * `duration = Infinity` y el vídeo puede quedarse en negro o sin poder
 * buscarse. Forzamos un seek al final para que el navegador calcule la duración
 * real y luego volvemos al inicio.
 *
 * Si se pasa `pipSrc`, se superpone un recuadro (modo PIP) con la cámara
 * sincronizada con la pista principal (play/pausa/seek/velocidad).
 */
export function RecordingPlayer({
  src,
  durationSec,
  pipSrc,
  pipOffsetMs = 0,
  pipLabel = "Cámara",
  pipPrefsKey,
}: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const pipRef = useRef<HTMLVideoElement | null>(null);
  const fixedRef = useRef(false);
  const [pipOn, setPipOn] = useState(!!pipSrc);
  const [corner, setCorner] = useState<Corner>("br");
  const [size, setSize] = useState<PipSize>("md");
  const [audioSource, setAudioSource] = useState<AudioSource>("main");
  const [trimMs, setTrimMs] = useState(0);
  const [drift, setDrift] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    fixedRef.current = false;
  }, [src]);

  // Restaura las preferencias guardadas del recuadro (tras hidratar).
  useEffect(() => {
    const prefs = loadPipPrefs(pipPrefsKey);
    if (prefs.corner) setCorner(prefs.corner);
    if (prefs.size) setSize(prefs.size);
    if (prefs.audio) setAudioSource(prefs.audio);
    if (typeof prefs.trimMs === "number") setTrimMs(prefs.trimMs);
    if (typeof prefs.on === "boolean") setPipOn(!!pipSrc && prefs.on);
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipPrefsKey]);

  // Guarda las preferencias cuando cambian.
  useEffect(() => {
    if (!loadedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        prefsStorageKey(pipPrefsKey),
        JSON.stringify({ corner, size, on: pipOn, audio: audioSource, trimMs } satisfies PipPrefs),
      );
    } catch {
      /* ignorar */
    }
  }, [corner, size, pipOn, audioSource, trimMs, pipPrefsKey]);

  useEffect(() => {
    if (!pipSrc) setPipOn(false);
  }, [pipSrc]);

  // Enruta el audio a una sola pista para que no se oigan dos veces desfasadas.
  useEffect(() => {
    const main = ref.current;
    const p = pipRef.current;
    const usePip = pipOn && !!pipSrc && audioSource === "pip";
    if (main) {
      main.muted = usePip;
      main.volume = usePip ? 0 : 1;
    }
    if (p) {
      p.muted = !usePip;
      p.volume = usePip ? 1 : 0;
    }
  }, [audioSource, pipOn, pipSrc]);

  // Sincroniza la pista PIP con la principal (vídeo y audio) corrigiendo deriva.
  useEffect(() => {
    const main = ref.current;
    if (!main || !pipOn || !pipSrc) return;
    let raf = 0;
    let hardSeekAt = 0;
    const offset = () => (pipOffsetMs + trimMs) / 1000;
    const target = () => Math.max(0, main.currentTime - offset());

    const hardSync = () => {
      const p = pipRef.current;
      if (!p) return;
      const t = target();
      try {
        p.currentTime = t;
      } catch {
        /* ignorar */
      }
      p.playbackRate = main.playbackRate;
      hardSeekAt = performance.now();
      setDrift(0);
    };

    // Bucle de corrección continua: deriva pequeña → ajuste fino de velocidad,
    // deriva grande → salto. Evita que el audio se separe con el tiempo.
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const p = pipRef.current;
      if (!p) return;
      const d = p.currentTime - target();
      setDrift(d);
      if (main.paused || main.seeking || p.seeking) return;
      if (Math.abs(d) > HARD_DRIFT) {
        if (performance.now() - hardSeekAt > 400) hardSync();
        return;
      }
      if (Math.abs(d) > SOFT_DRIFT) {
        // Aceleramos o frenamos ligeramente la pista secundaria hasta alinearla.
        const nudge = Math.max(-0.08, Math.min(0.08, -d * 0.5));
        p.playbackRate = Math.max(0.25, main.playbackRate * (1 + nudge));
      } else if (p.playbackRate !== main.playbackRate) {
        p.playbackRate = main.playbackRate;
      }
      if (p.paused) void p.play().catch(() => {});
    };

    const onPlay = () => {
      hardSync();
      void pipRef.current?.play().catch(() => {});
    };
    const onPause = () => pipRef.current?.pause();
    let autoPaused = false;
    // Si la secundaria se queda sin datos, pausamos la principal para no perder el sincronismo.
    const onPipWaiting = () => {
      if (!main.paused) {
        autoPaused = true;
        main.pause();
      }
    };
    const onPipPlayable = () => {
      if (autoPaused) {
        autoPaused = false;
        void main.play().catch(() => {});
      }
    };


    main.addEventListener("play", onPlay);
    main.addEventListener("playing", onPlay);
    main.addEventListener("pause", onPause);
    main.addEventListener("seeked", hardSync);
    main.addEventListener("ratechange", hardSync);
    const p0 = pipRef.current;
    p0?.addEventListener("waiting", onPipWaiting);
    p0?.addEventListener("canplay", onPipPlayable);
    if (!main.paused) onPlay();
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      main.removeEventListener("play", onPlay);
      main.removeEventListener("playing", onPlay);
      main.removeEventListener("pause", onPause);
      main.removeEventListener("seeked", hardSync);
      main.removeEventListener("ratechange", hardSync);
      p0?.removeEventListener("waiting", onPipWaiting);
      p0?.removeEventListener("canplay", onPipPlayable);
    };
  }, [pipOn, pipSrc, pipOffsetMs, trimMs]);


  function fixDuration() {
    const v = ref.current;
    if (!v || fixedRef.current) return;
    if (v.duration === Infinity || Number.isNaN(v.duration)) {
      fixedRef.current = true;
      const onUpdate = () => {
        v.removeEventListener("timeupdate", onUpdate);
        v.currentTime = 0;
      };
      v.addEventListener("timeupdate", onUpdate);
      try {
        v.currentTime = 1e6;
      } catch {
        /* ignorar */
      }
    } else {
      fixedRef.current = true;
      // Pintamos el primer fotograma para que no se vea el vídeo en negro.
      if (v.currentTime === 0) {
        try {
          v.currentTime = 0.05;
        } catch {
          /* ignorar */
        }
      }
    }
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <video
          ref={ref}
          src={src}
          controls
          preload="auto"
          playsInline
          onLoadedMetadata={fixDuration}
          onLoadedData={fixDuration}
          className="w-full max-h-[70vh] rounded-md bg-black"
        />
        {pipSrc && pipOn && (
          <div
            className={`absolute ${CORNER_CLASS[corner]} ${SIZE_CLASS[size]} overflow-hidden rounded-md border-2 border-background shadow-lg`}
          >
            <video
              ref={pipRef}
              src={pipSrc}
              muted
              playsInline
              preload="auto"
              aria-label={`${pipLabel} en recuadro sincronizado`}
              className="block w-full bg-black"
              onClick={() => {
                const next: Record<Corner, Corner> = { br: "bl", bl: "tl", tl: "tr", tr: "br" };
                setCorner(next[corner]);
              }}
            />
            <button
              type="button"
              onClick={() => setPipOn(false)}
              aria-label="Ocultar recuadro de cámara"
              className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {durationSec ? (
          <p className="text-xs text-muted-foreground">Duración: {Math.round(durationSec)} s</p>
        ) : null}
        {pipSrc && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => setPipOn((v) => !v)}
            aria-pressed={pipOn}
          >
            <PictureInPicture2 className="h-3.5 w-3.5" />
            {pipOn ? "Ocultar cámara (PIP)" : `Ver ${pipLabel} en recuadro`}
          </Button>
        )}
        {pipSrc && pipOn && (
          <>
            <div className="flex items-center gap-1" role="group" aria-label="Tamaño del recuadro">
              {SIZES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={size === s ? "default" : "outline"}
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  aria-label={`Tamaño ${SIZE_LABEL[s]}`}
                >
                  {SIZE_LABEL[s]}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Toca el recuadro para moverlo de esquina. Se recuerda su posición y tamaño.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
