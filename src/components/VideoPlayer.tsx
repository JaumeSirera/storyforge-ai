import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import type { VideoClip, VideoSource } from "@/lib/story-types";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

/* ---------- Shared imperative controller for keyboard/ARIA controls ---------- */
export type PlayerController = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekBy: (deltaSec: number) => void;
  isPaused: () => boolean;
};

type ControllerRef = React.MutableRefObject<PlayerController | null>;

/* ---------- YouTube IFrame API loader ---------- */
let ytReady: Promise<any> | null = null;
function loadYouTubeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).YT?.Player) return Promise.resolve((window as any).YT);
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve((window as any).YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytReady;
}

/* ---------- Vimeo Player API loader ---------- */
let vimeoReady: Promise<any> | null = null;
function loadVimeoAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).Vimeo?.Player) return Promise.resolve((window as any).Vimeo);
  if (vimeoReady) return vimeoReady;
  vimeoReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://player.vimeo.com/api/player.js";
    s.async = true;
    s.onload = () => resolve((window as any).Vimeo);
    s.onerror = () => reject(new Error("Vimeo API failed to load"));
    document.head.appendChild(s);
  });
  return vimeoReady;
}

interface SingleVideoProps {
  video: VideoSource;
  pauseAtSec?: number;
  onPauseAtTime?: () => void;
  onTriggerReset?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (t: number) => void;
  startAt?: number;
  fill?: boolean;
  controllerRef?: ControllerRef;
}

type CbsRef = React.MutableRefObject<{
  onPauseAtTime?: () => void;
  onTriggerReset?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (t: number) => void;
  pauseAtSec?: number;
}>;

/**
 * Keeps time-based decision points in sync with the real playback position.
 * Fires the trigger when the head crosses it, and re-arms it when the user
 * seeks (or rewinds) back before the trigger, so pausing/seeking never leaves
 * the scene in a stale state.
 */
function syncTrigger(
  cbsRef: CbsRef,
  firedRef: React.MutableRefObject<boolean>,
  cur: number,
  pause: () => void,
) {
  if (typeof cur !== "number" || Number.isNaN(cur)) return;
  cbsRef.current.onTimeUpdate?.(cur);
  const tgt = cbsRef.current.pauseAtSec;
  if (typeof tgt !== "number") return;
  if (!firedRef.current && cur >= tgt) {
    firedRef.current = true;
    pause();
    cbsRef.current.onPauseAtTime?.();
    return;
  }
  if (firedRef.current && cur < tgt - 0.75) {
    firedRef.current = false;
    cbsRef.current.onTriggerReset?.();
  }
}



function MediaWithDialogue({
  src,
  dialogueUrl,
  sizeCls,
  fill,
  cbsRef,
  firedRef,
  startAt,
  controllerRef,
}: {
  src: string;
  dialogueUrl: string | null;
  sizeCls: string;
  fill?: boolean;
  cbsRef: CbsRef;
  firedRef: React.MutableRefObject<boolean>;
  startAt?: number;
  controllerRef?: ControllerRef;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekedRef = useRef(false);

  // Publish imperative controls for the accessible toolbar / keyboard shortcuts.
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      play: () => { videoRef.current?.play().catch(() => {}); },
      pause: () => { videoRef.current?.pause(); },
      toggle: () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play().catch(() => {}); else v.pause();
      },
      seekBy: (delta) => {
        const v = videoRef.current;
        if (!v) return;
        const dur = isFinite(v.duration) ? v.duration : Number.MAX_SAFE_INTEGER;
        v.currentTime = Math.max(0, Math.min(dur, v.currentTime + delta));
      },
      isPaused: () => !!videoRef.current?.paused,
    };
    return () => { if (controllerRef.current) controllerRef.current = null; };
  }, [controllerRef, src]);

  // Keep audio in sync with video events.
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a) return;
    const sync = () => {
      if (Math.abs(a.currentTime - v.currentTime) > 0.25) a.currentTime = v.currentTime;
    };
    const onPlay = () => {
      sync();
      a.play().catch(() => {});
    };
    const onPause = () => a.pause();
    const onSeeked = () => (a.currentTime = v.currentTime);
    const onRate = () => (a.playbackRate = v.playbackRate);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ratechange", onRate);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ratechange", onRate);
    };
  }, [dialogueUrl, src]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        controls
        autoPlay
        playsInline
        aria-label="Reproductor de vídeo de la escena"
        className={`${sizeCls} bg-black ${fill ? "object-contain" : ""}`}
        onLoadedMetadata={(e) => {
          if (!seekedRef.current && typeof startAt === "number" && startAt > 0) {
            seekedRef.current = true;
            try { e.currentTarget.currentTime = startAt; } catch {}
          }
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          syncTrigger(cbsRef, firedRef, el.currentTime, () => el.pause());
        }}
        onSeeked={(e) => {
          const el = e.currentTarget;
          syncTrigger(cbsRef, firedRef, el.currentTime, () => el.pause());
        }}

        onEnded={() => {
          audioRef.current?.pause();
          cbsRef.current.onEnded?.();
        }}
      />
      {dialogueUrl && <audio ref={audioRef} src={dialogueUrl} preload="auto" />}
    </>
  );
}




function SingleVideo({ video, pauseAtSec, onPauseAtTime, onTriggerReset, onEnded, onTimeUpdate, startAt, fill, controllerRef }: SingleVideoProps) {
  const cbsRef = useRef({ onPauseAtTime, onTriggerReset, onEnded, onTimeUpdate, pauseAtSec });
  useEffect(() => {
    cbsRef.current = { onPauseAtTime, onTriggerReset, onEnded, onTimeUpdate, pauseAtSec };
  }, [onPauseAtTime, onTriggerReset, onEnded, onTimeUpdate, pauseAtSec]);

  const firedRef = useRef(false);
  useEffect(() => {
    firedRef.current = false;
  }, [video, pauseAtSec]);

  // "Sin vídeo" should still trigger end-bound questions.
  useEffect(() => {
    if (video.type !== "none") return;
    const t = setTimeout(() => cbsRef.current.onEnded?.(), 50);
    return () => clearTimeout(t);
  }, [video]);

  const sizeCls = fill ? "absolute inset-0 h-full w-full" : "aspect-video w-full rounded-xl";

  /* ---------- MP4 (also used for ready AI clips) ---------- */
  if (video.type === "mp4" || (video.type === "ai" && video.status === "ready" && video.url)) {
    const lipsyncReady =
      video.type === "ai" && video.lipsync?.status === "ready" && video.lipsync.url;
    const url = (lipsyncReady ? (video as any).lipsync.url : video.url) as string;
    const dialogueAudio =
      !lipsyncReady && video.type === "ai" && video.dialogue?.status === "ready" && video.dialogue.audioUrl
        ? video.dialogue.audioUrl
        : null;
    return (
      <MediaWithDialogue
        key={url}
        src={url}
        dialogueUrl={dialogueAudio}
        sizeCls={sizeCls}
        fill={fill}
        cbsRef={cbsRef}
        firedRef={firedRef}
        startAt={startAt}
        controllerRef={controllerRef}
      />
    );
  }



  if (video.type === "ai") {
    const label =
      video.status === "failed"
        ? `Generación fallida${video.error ? `: ${video.error}` : ""}`
        : "Generando vídeo con IA...";
    return (
      <div className={`${sizeCls} grid place-items-center bg-gradient-to-br from-secondary to-accent text-muted-foreground text-center px-6`}>
        <span className="text-sm">{label}</span>
      </div>
    );
  }

  if (video.type === "none") {
    return (
      <div className={`${sizeCls} grid place-items-center bg-gradient-to-br from-secondary to-accent text-muted-foreground`}>
        <span className="text-sm">Escena narrada (sin vídeo)</span>
      </div>
    );
  }

  /* ---------- YouTube ---------- */
  if (video.type === "youtube") {
    return <YouTubePlayer video={video} cbsRef={cbsRef} firedRef={firedRef} fill={fill} startAt={startAt} controllerRef={controllerRef} />;
  }

  /* ---------- Vimeo ---------- */
  if (video.type === "vimeo") {
    return <VimeoPlayer video={video} cbsRef={cbsRef} firedRef={firedRef} fill={fill} startAt={startAt} controllerRef={controllerRef} />;
  }


  return null;
}

function YouTubePlayer({
  video,
  cbsRef,
  firedRef,
  fill,
  startAt,
  controllerRef,
}: {
  video: Extract<VideoSource, { type: "youtube" }>;
  cbsRef: CbsRef;
  firedRef: React.MutableRefObject<boolean>;
  fill?: boolean;
  startAt?: number;
  controllerRef?: ControllerRef;
}) {

  const hostRef = useRef<HTMLDivElement | null>(null);
  const id = getYouTubeId(video.url);

  useEffect(() => {
    if (!id || !hostRef.current) return;
    let player: any = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    const div = document.createElement("div");
    hostRef.current.innerHTML = "";
    hostRef.current.appendChild(div);

    loadYouTubeAPI().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(div, {
        videoId: id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e: any) => {
            try {
              if (typeof startAt === "number" && startAt > 0) {
                e.target.seekTo(startAt, true);
              }
              e.target.playVideo();
            } catch {}
            if (controllerRef) {
              controllerRef.current = {
                play: () => { try { player.playVideo(); } catch {} },
                pause: () => { try { player.pauseVideo(); } catch {} },
                toggle: () => {
                  try {
                    const state = player.getPlayerState?.();
                    // 1 = playing
                    if (state === 1) player.pauseVideo(); else player.playVideo();
                  } catch {}
                },
                seekBy: (delta) => {
                  try {
                    const t = player.getCurrentTime?.() ?? 0;
                    const dur = player.getDuration?.() ?? Number.MAX_SAFE_INTEGER;
                    player.seekTo(Math.max(0, Math.min(dur, t + delta)), true);
                  } catch {}
                },
                isPaused: () => {
                  try { return player.getPlayerState?.() !== 1; } catch { return true; }
                },
              };
            }
            interval = setInterval(() => {
              try {
                const t = player.getCurrentTime();
                if (typeof t === "number") {
                  syncTrigger(cbsRef, firedRef, t, () => player.pauseVideo());
                }
              } catch {}
            }, 250);
          },

          onStateChange: (e: any) => {
            // 0 = ended
            if (e.data === 0) cbsRef.current.onEnded?.();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (controllerRef?.current) controllerRef.current = null;
      try { player?.destroy?.(); } catch {}
    };
  }, [id, video.url]);

  const wrapCls = fill
    ? "absolute inset-0 h-full w-full overflow-hidden bg-black"
    : "aspect-video w-full overflow-hidden rounded-xl bg-black";

  if (!id) {
    return (
      <div className={`${wrapCls} grid place-items-center text-muted-foreground text-sm`}>
        URL de YouTube no válida
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
}

function VimeoPlayer({
  video,
  cbsRef,
  firedRef,
  fill,
  startAt,
  controllerRef,
}: {
  video: Extract<VideoSource, { type: "vimeo" }>;
  cbsRef: CbsRef;
  firedRef: React.MutableRefObject<boolean>;
  fill?: boolean;
  startAt?: number;
  controllerRef?: ControllerRef;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const id = getVimeoId(video.url);
  const src = id
    ? `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1`
    : null;

  useEffect(() => {
    if (!iframeRef.current || !src) return;
    let player: any = null;
    let cancelled = false;
    let pausedState = false;
    loadVimeoAPI().then((Vimeo) => {
      if (cancelled || !iframeRef.current) return;
      player = new Vimeo.Player(iframeRef.current);
      if (typeof startAt === "number" && startAt > 0) {
        player.setCurrentTime(startAt).catch(() => {});
      }
      player.play().catch(() => {});
      player.on("play", () => { pausedState = false; });
      player.on("pause", () => { pausedState = true; });
      if (controllerRef) {
        controllerRef.current = {
          play: () => { player?.play?.().catch(() => {}); },
          pause: () => { player?.pause?.().catch(() => {}); },
          toggle: () => {
            if (pausedState) player?.play?.().catch(() => {});
            else player?.pause?.().catch(() => {});
          },
          seekBy: (delta) => {
            player?.getCurrentTime?.().then((t: number) => {
              player?.getDuration?.().then((dur: number) => {
                const target = Math.max(0, Math.min(dur || Number.MAX_SAFE_INTEGER, t + delta));
                player?.setCurrentTime?.(target).catch(() => {});
              }).catch(() => {
                player?.setCurrentTime?.(Math.max(0, t + delta)).catch(() => {});
              });
            }).catch(() => {});
          },
          isPaused: () => pausedState,
        };
      }
      player.on("timeupdate", (data: { seconds: number }) => {
        syncTrigger(cbsRef, firedRef, data.seconds, () => player.pause().catch(() => {}));
      });
      player.on("seeked", (data: { seconds: number }) => {
        syncTrigger(cbsRef, firedRef, data.seconds, () => player.pause().catch(() => {}));
      });
      player.on("ended", () => cbsRef.current.onEnded?.());
    });
    return () => {
      cancelled = true;
      if (controllerRef?.current) controllerRef.current = null;
      try { player?.destroy?.(); } catch {}
    };
  }, [src]);



  const wrapCls = fill
    ? "absolute inset-0 h-full w-full overflow-hidden bg-black"
    : "aspect-video w-full overflow-hidden rounded-xl bg-black";

  if (!src) {
    return (
      <div className={`${wrapCls} grid place-items-center text-muted-foreground text-sm`}>
        URL de Vimeo no válida
      </div>
    );
  }

  return (
    <div className={wrapCls}>
      <iframe
        ref={iframeRef}
        src={src}
        title="Reproductor de vídeo (Vimeo)"
        className="w-full h-full"
        allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/* ---------- Accessible playback controls (ARIA + keyboard) ---------- */
function AccessibleControls({
  controllerRef,
  overlay,
  liveRef,
}: {
  controllerRef: ControllerRef;
  overlay?: boolean;
  liveRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const [isPaused, setIsPaused] = useState(false);

  // Poll state so button label stays in sync across player types.
  useEffect(() => {
    const t = setInterval(() => {
      const p = controllerRef.current?.isPaused?.();
      if (typeof p === "boolean") setIsPaused(p);
    }, 300);
    return () => clearInterval(t);
  }, [controllerRef]);

  const announce = (msg: string) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };
  const doRewind = () => { controllerRef.current?.seekBy(-10); announce("Retrocedido 10 segundos"); };
  const doForward = () => { controllerRef.current?.seekBy(10); announce("Adelantado 10 segundos"); };
  const doToggle = () => {
    controllerRef.current?.toggle();
    const nowPaused = !!controllerRef.current?.isPaused?.();
    setIsPaused(nowPaused);
    announce(nowPaused ? "Vídeo pausado" : "Vídeo reproduciéndose");
  };

  // Portrait phones and short landscape viewports: compact horizontal bar at
  // the top-left. Only on roomy screens does it become a vertical side rail.
  const wrapCls = overlay
    ? "absolute z-50 flex pointer-events-auto rounded-full bg-black/70 backdrop-blur-md shadow-lg gap-1 items-center max-w-[calc(100%-1rem)] left-2 top-2 flex-row px-2 py-1 [@media(min-width:640px)and(min-height:500px)]:left-3 [@media(min-width:640px)and(min-height:500px)]:top-1/2 [@media(min-width:640px)and(min-height:500px)]:-translate-y-1/2 [@media(min-width:640px)and(min-height:500px)]:flex-col [@media(min-width:640px)and(min-height:500px)]:px-1 [@media(min-width:640px)and(min-height:500px)]:py-2"
    : "mt-2 flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 w-fit";


  const btnBase = overlay
    ? "inline-flex items-center justify-center min-h-11 min-w-11 rounded-full text-white hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black transition"
    : "inline-flex items-center justify-center min-h-11 min-w-11 rounded-full text-foreground hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background transition";

  return (
    <div className={wrapCls} role="toolbar" aria-label="Controles de reproducción">
      <button type="button" onClick={doRewind} aria-label="Retroceder 10 segundos" className={btnBase}>
        <RotateCcw className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={doToggle}
        aria-label={isPaused ? "Reproducir" : "Pausar"}
        aria-pressed={!isPaused}
        className={btnBase}
      >
        {isPaused ? <Play className="h-5 w-5" aria-hidden="true" /> : <Pause className="h-5 w-5" aria-hidden="true" />}
      </button>
      <button type="button" onClick={doForward} aria-label="Avanzar 10 segundos" className={btnBase}>
        <RotateCw className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function VideoPlayer({
  video,
  videos,
  activeClipId,
  onActiveClipChange,
  pauseAtSec,
  onPauseAtTime,
  onTriggerReset,
  onEnded,
  onTimeUpdate,
  startAt,
  fill,
}: {
  video?: VideoSource;
  videos?: VideoClip[];
  activeClipId?: string;
  onActiveClipChange?: (clipId: string) => void;
  pauseAtSec?: number;
  onPauseAtTime?: () => void;
  onTriggerReset?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (t: number) => void;
  startAt?: number;
  fill?: boolean;
}) {
  const clips: VideoClip[] = useMemo(() => {
    if (videos && videos.length > 0) return videos;
    if (video) return [{ id: "default", label: "Clip principal", source: video }];
    return [{ id: "default", label: "Clip principal", source: { type: "none" } }];
  }, [video, videos]);

  const [internalActiveId, setInternalActiveId] = useState<string>(clips[0]?.id ?? "default");
  const effectiveId = activeClipId ?? internalActiveId;
  const active = clips.find((c) => c.id === effectiveId) ?? clips[0];

  const select = (id: string) => {
    if (onActiveClipChange) onActiveClipChange(id);
    else setInternalActiveId(id);
  };

  const controllerRef = useRef<PlayerController | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Keyboard shortcuts scoped to the player container.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ignore keys typed inside inputs/textareas.
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (target as any)?.isContentEditable) return;

    if (e.key === " " || e.key === "k" || e.key === "K") {
      e.preventDefault();
      controllerRef.current?.toggle();
    } else if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
      e.preventDefault();
      controllerRef.current?.seekBy(-10);
      if (liveRef.current) liveRef.current.textContent = "Retrocedido 10 segundos";
    } else if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
      e.preventDefault();
      controllerRef.current?.seekBy(10);
      if (liveRef.current) liveRef.current.textContent = "Adelantado 10 segundos";
    }
  }, []);

  const single = (
    <SingleVideo
      video={active.source}
      pauseAtSec={pauseAtSec}
      onPauseAtTime={onPauseAtTime}
      onTriggerReset={onTriggerReset}
      onEnded={onEnded}
      onTimeUpdate={onTimeUpdate}
      startAt={startAt}
      fill={fill}
      controllerRef={controllerRef}
    />
  );

  const liveRegion = (
    <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />
  );

  if (clips.length <= 1) {
    if (fill) {
      // In fill mode the container is positioned by the parent; we overlay controls.
      return (
        <div
          ref={wrapRef}
          tabIndex={0}
          role="region"
          aria-label="Reproductor de vídeo interactivo"
          onKeyDown={onKeyDown}
          className="contents focus:outline-none"
        >
          {single}
          {liveRegion}
        </div>
      );
    }
    return (
      <div
        ref={wrapRef}
        tabIndex={0}
        role="region"
        aria-label="Reproductor de vídeo interactivo"
        onKeyDown={onKeyDown}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
      >
        {single}
        <AccessibleControls controllerRef={controllerRef} liveRef={liveRef} />
        {liveRegion}
      </div>
    );
  }

  if (fill) {
    return (
      <div
        ref={wrapRef}
        tabIndex={0}
        role="region"
        aria-label="Reproductor de vídeo interactivo"
        onKeyDown={onKeyDown}
        className="contents focus:outline-none"
      >
        <SingleVideo
          key={active.id}
          video={active.source}
          pauseAtSec={pauseAtSec}
          onPauseAtTime={onPauseAtTime}
          onTriggerReset={onTriggerReset}
          onEnded={onEnded}
          onTimeUpdate={onTimeUpdate}
          startAt={startAt}
          fill
          controllerRef={controllerRef}
        />
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center gap-1.5 pointer-events-auto max-w-[calc(100%-10rem)] [@media(min-width:640px)and(min-height:500px)]:max-w-[calc(100%-8rem)]"
          role="tablist"
          aria-label="Clips de la escena"
        >
          {clips.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === active.id}
              onClick={() => select(c.id)}
              className={`text-xs rounded-full border px-3 py-1 backdrop-blur-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                c.id === active.id
                  ? "border-primary bg-primary/80 text-primary-foreground"
                  : "border-white/30 bg-black/40 text-white hover:bg-black/60"
              }`}
            >
              {c.label || `Clip ${i + 1}`}
            </button>
          ))}
        </div>
        
        {liveRegion}
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="region"
      aria-label="Reproductor de vídeo interactivo"
      onKeyDown={onKeyDown}
      className="space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
    >
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Clips de la escena">
        {clips.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === active.id}
            onClick={() => select(c.id)}
            className={`text-xs rounded-full border px-3 py-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              c.id === active.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent"
            }`}
          >
            {c.label || `Clip ${i + 1}`}
          </button>
        ))}
      </div>
      <SingleVideo
        key={active.id}
        video={active.source}
        pauseAtSec={pauseAtSec}
        onPauseAtTime={onPauseAtTime}
        onTriggerReset={onTriggerReset}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        startAt={startAt}
        controllerRef={controllerRef}
      />
      <AccessibleControls controllerRef={controllerRef} liveRef={liveRef} />
      {liveRegion}
    </div>
  );
}
