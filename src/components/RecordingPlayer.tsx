import { useEffect, useRef } from "react";

interface Props {
  src: string;
  /** Duración conocida (segundos) para mostrarla mientras el navegador la calcula. */
  durationSec?: number | null;
}

/**
 * Reproductor de grabaciones MediaRecorder (WebM). Los archivos generados por
 * MediaRecorder no llevan duración en la cabecera, así que Chrome devuelve
 * `duration = Infinity` y el vídeo puede quedarse en negro o sin poder
 * buscarse. Forzamos un seek al final para que el navegador calcule la duración
 * real y luego volvemos al inicio.
 */
export function RecordingPlayer({ src, durationSec }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const fixedRef = useRef(false);

  useEffect(() => {
    fixedRef.current = false;
  }, [src]);

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
      {durationSec ? (
        <p className="text-xs text-muted-foreground">Duración: {Math.round(durationSec)} s</p>
      ) : null}
    </div>
  );
}
