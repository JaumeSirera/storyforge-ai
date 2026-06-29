import { useMemo, useState } from "react";
import type { VideoClip, VideoSource } from "@/lib/story-types";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function SingleVideo({ video }: { video: VideoSource }) {
  const embed = useMemo(() => {
    if (video.type === "youtube") {
      const id = getYouTubeId(video.url);
      return id ? `https://www.youtube.com/embed/${id}?rel=0&autoplay=1&playsinline=1` : null;
    }
    if (video.type === "vimeo") {
      const id = getVimeoId(video.url);
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1&playsinline=1` : null;
    }
    return null;
  }, [video]);

  if (video.type === "none") {
    return (
      <div className="aspect-video w-full grid place-items-center rounded-xl bg-gradient-to-br from-secondary to-accent text-muted-foreground">
        <span className="text-sm">Escena narrada (sin vídeo)</span>
      </div>
    );
  }

  if (video.type === "mp4") {
    return (
      <video
        key={video.url}
        src={video.url}
        controls
        autoPlay
        muted
        playsInline
        className="w-full aspect-video rounded-xl bg-black"
      />
    );
  }

  if (!embed) {
    return (
      <div className="aspect-video w-full grid place-items-center rounded-xl bg-muted text-muted-foreground text-sm">
        URL de vídeo no válida
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        key={embed}
        src={embed}
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
}: {
  video?: VideoSource;
  videos?: VideoClip[];
}) {
  const clips: VideoClip[] = useMemo(() => {
    if (videos && videos.length > 0) return videos;
    if (video) return [{ id: "default", label: "Clip principal", source: video }];
    return [{ id: "default", label: "Clip principal", source: { type: "none" } }];
  }, [video, videos]);

  const [activeId, setActiveId] = useState<string>(clips[0]?.id ?? "default");
  const active = clips.find((c) => c.id === activeId) ?? clips[0];

  if (clips.length <= 1) {
    return <SingleVideo video={active.source} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {clips.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveId(c.id)}
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
      <SingleVideo video={active.source} />
    </div>
  );
}
