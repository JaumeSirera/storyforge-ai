import { useEffect, useMemo, useRef, useState } from "react";
import type { VideoClip, VideoSource } from "@/lib/story-types";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

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
  /** When set (>0), pause playback at this many seconds and call onPauseAtTime. */
  pauseAtSec?: number;
  onPauseAtTime?: () => void;
  onEnded?: () => void;
  fill?: boolean;
}

function SingleVideo({ video, pauseAtSec, onPauseAtTime, onEnded, fill }: SingleVideoProps) {
  const cbsRef = useRef({ onPauseAtTime, onEnded, pauseAtSec });
  useEffect(() => {
    cbsRef.current = { onPauseAtTime, onEnded, pauseAtSec };
  }, [onPauseAtTime, onEnded, pauseAtSec]);

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

  /* ---------- MP4 ---------- */
  if (video.type === "mp4") {
    return (
      <video
        key={video.url}
        src={video.url}
        controls
        autoPlay
        playsInline
        className={`${sizeCls} bg-black ${fill ? "object-contain" : ""}`}
        onTimeUpdate={(e) => {
          const cur = e.currentTarget.currentTime;
          const tgt = cbsRef.current.pauseAtSec;
          if (tgt && !firedRef.current && cur >= tgt) {
            firedRef.current = true;
            e.currentTarget.pause();
            cbsRef.current.onPauseAtTime?.();
          }
        }}
        onEnded={() => cbsRef.current.onEnded?.()}
      />
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
    return <YouTubePlayer video={video} cbsRef={cbsRef} firedRef={firedRef} fill={fill} />;
  }

  /* ---------- Vimeo ---------- */
  if (video.type === "vimeo") {
    return <VimeoPlayer video={video} cbsRef={cbsRef} firedRef={firedRef} fill={fill} />;
  }

  return null;
}

function YouTubePlayer({
  video,
  cbsRef,
  firedRef,
}: {
  video: Extract<VideoSource, { type: "youtube" }>;
  cbsRef: React.MutableRefObject<{ onPauseAtTime?: () => void; onEnded?: () => void; pauseAtSec?: number }>;
  firedRef: React.MutableRefObject<boolean>;
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
            try { e.target.playVideo(); } catch {}
            interval = setInterval(() => {
              const tgt = cbsRef.current.pauseAtSec;
              if (!tgt || firedRef.current) return;
              try {
                const t = player.getCurrentTime();
                if (typeof t === "number" && t >= tgt) {
                  firedRef.current = true;
                  player.pauseVideo();
                  cbsRef.current.onPauseAtTime?.();
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
      try { player?.destroy?.(); } catch {}
    };
  }, [id, video.url]);

  if (!id) {
    return (
      <div className="aspect-video w-full grid place-items-center rounded-xl bg-muted text-muted-foreground text-sm">
        URL de YouTube no válida
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
}

function VimeoPlayer({
  video,
  cbsRef,
  firedRef,
}: {
  video: Extract<VideoSource, { type: "vimeo" }>;
  cbsRef: React.MutableRefObject<{ onPauseAtTime?: () => void; onEnded?: () => void; pauseAtSec?: number }>;
  firedRef: React.MutableRefObject<boolean>;
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
    loadVimeoAPI().then((Vimeo) => {
      if (cancelled || !iframeRef.current) return;
      player = new Vimeo.Player(iframeRef.current);
      player.play().catch(() => {});
      player.on("timeupdate", (data: { seconds: number }) => {
        const tgt = cbsRef.current.pauseAtSec;
        if (!tgt || firedRef.current) return;
        if (data.seconds >= tgt) {
          firedRef.current = true;
          player.pause().catch(() => {});
          cbsRef.current.onPauseAtTime?.();
        }
      });
      player.on("ended", () => cbsRef.current.onEnded?.());
    });
    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch {}
    };
  }, [src]);

  if (!src) {
    return (
      <div className="aspect-video w-full grid place-items-center rounded-xl bg-muted text-muted-foreground text-sm">
        URL de Vimeo no válida
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        ref={iframeRef}
        src={src}
        className="w-full h-full"
        allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
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
  onEnded,
}: {
  video?: VideoSource;
  videos?: VideoClip[];
  activeClipId?: string;
  onActiveClipChange?: (clipId: string) => void;
  /** Pause active clip at this many seconds and notify. */
  pauseAtSec?: number;
  onPauseAtTime?: () => void;
  onEnded?: () => void;
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

  if (clips.length <= 1) {
    return (
      <SingleVideo
        video={active.source}
        pauseAtSec={pauseAtSec}
        onPauseAtTime={onPauseAtTime}
        onEnded={onEnded}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {clips.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => select(c.id)}
            className={`text-xs rounded-full border px-3 py-1 transition ${
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
        onEnded={onEnded}
      />
    </div>
  );
}
