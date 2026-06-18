import { useMemo } from "react";

type VideoSource =
  | { type: "youtube"; url: string }
  | { type: "vimeo"; url: string }
  | { type: "mp4"; url: string }
  | { type: "none" };

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function VideoPlayer({ video }: { video: VideoSource }) {
  const embed = useMemo(() => {
    if (video.type === "youtube") {
      const id = getYouTubeId(video.url);
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }
    if (video.type === "vimeo") {
      const id = getVimeoId(video.url);
      return id ? `https://player.vimeo.com/video/${id}` : null;
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
        src={video.url}
        controls
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
        src={embed}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
