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

type PipPrefs = { corner: Corner; size: PipSize; on: boolean };

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
  const loadedRef = useRef(false);

  useEffect(() => {
    fixedRef.current = false;
  }, [src]);

  // Restaura las preferencias guardadas del recuadro (tras hidratar).
  useEffect(() => {
    const prefs = loadPipPrefs(pipPrefsKey);
    if (prefs.corner) setCorner(prefs.corner);
    if (prefs.size) setSize(prefs.size);
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
        JSON.stringify({ corner, size, on: pipOn } satisfies PipPrefs),
      );
    } catch {
      /* ignorar */
    }
  }, [corner, size, pipOn, pipPrefsKey]);

  useEffect(() => {
    if (!pipSrc) setPipOn(false);
  }, [pipSrc]);


  // Sincroniza la pista PIP con la principal.
  useEffect(() => {
    const main = ref.current;
    if (!main || !pipOn || !pipSrc) return;
    const target = () => Math.max(0, main.currentTime - pipOffsetMs / 1000);
    const sync = (force = false) => {
      const p = pipRef.current;
      if (!p) return;
      const t = target();
      if (force || Math.abs(p.currentTime - t) > 0.35) {
        try {
          p.currentTime = t;
        } catch {
          /* ignorar */
        }
      }
      p.playbackRate = main.playbackRate;
    };
    const onPlay = () => {
      sync(true);
      void pipRef.current?.play().catch(() => {});
    };
    const onPause = () => pipRef.current?.pause();
    const onSeeked = () => sync(true);
    const onTime = () => sync();
    main.addEventListener("play", onPlay);
    main.addEventListener("pause", onPause);
    main.addEventListener("seeked", onSeeked);
    main.addEventListener("timeupdate", onTime);
    main.addEventListener("ratechange", onTime);
    if (!main.paused) onPlay();
    return () => {
      main.removeEventListener("play", onPlay);
      main.removeEventListener("pause", onPause);
      main.removeEventListener("seeked", onSeeked);
      main.removeEventListener("timeupdate", onTime);
      main.removeEventListener("ratechange", onTime);
    };
  }, [pipOn, pipSrc, pipOffsetMs]);

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
          <span className="text-xs text-muted-foreground">
            Toca el recuadro para moverlo de esquina.
          </span>
        )}
      </div>
    </div>
  );
}
