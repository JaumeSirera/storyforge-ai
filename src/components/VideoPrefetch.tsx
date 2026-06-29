import { useEffect, useMemo } from "react";
import { nodeClips, type StoryNode } from "@/lib/story-types";

/**
 * Precarga (best-effort) los vídeos de los próximos posibles nodos para que la
 * ramificación sea instantánea:
 *  - MP4: <video preload="auto"> oculto que descarga metadatos + buffer inicial.
 *  - YouTube/Vimeo: <link rel="preconnect"> y <link rel="prefetch"> a los orígenes
 *    y a la URL del iframe para abrir la conexión TLS y cachear el documento.
 */
export function VideoPrefetch({ nodes }: { nodes: StoryNode[] }) {
  const mp4Urls = useMemo(() => {
    const out: string[] = [];
    for (const n of nodes) {
      for (const c of nodeClips(n)) {
        if (c.source.type === "mp4" && c.source.url) out.push(c.source.url);
      }
    }
    return Array.from(new Set(out));
  }, [nodes]);

  const externals = useMemo(() => {
    const out: { origin: string; embed?: string }[] = [];
    for (const n of nodes) {
      for (const c of nodeClips(n)) {
        if (c.source.type === "youtube") {
          const m = c.source.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
          if (m) {
            out.push({
              origin: "https://www.youtube.com",
              embed: `https://www.youtube.com/embed/${m[1]}?rel=0`,
            });
            out.push({ origin: "https://i.ytimg.com" });
            out.push({ origin: "https://www.google.com" });
          }
        } else if (c.source.type === "vimeo") {
          const m = c.source.url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
          if (m) {
            out.push({
              origin: "https://player.vimeo.com",
              embed: `https://player.vimeo.com/video/${m[1]}`,
            });
            out.push({ origin: "https://i.vimeocdn.com" });
            out.push({ origin: "https://f.vimeocdn.com" });
          }
        }
      }
    }
    return out;
  }, [nodes]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const added: HTMLLinkElement[] = [];
    const origins = new Set<string>();
    const embeds = new Set<string>();
    for (const e of externals) {
      origins.add(e.origin);
      if (e.embed) embeds.add(e.embed);
    }
    for (const o of origins) {
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = o;
      l.crossOrigin = "anonymous";
      document.head.appendChild(l);
      added.push(l);
    }
    for (const u of embeds) {
      const l = document.createElement("link");
      l.rel = "prefetch";
      l.href = u;
      l.as = "document";
      document.head.appendChild(l);
      added.push(l);
    }
    return () => {
      for (const l of added) l.remove();
    };
  }, [externals]);

  if (mp4Urls.length === 0) return null;
  return (
    <div aria-hidden className="sr-only" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      {mp4Urls.map((u) => (
        <video key={u} src={u} preload="auto" muted playsInline />
      ))}
    </div>
  );
}

/** Devuelve los nodos destino directos de las ramas del nodo actual. */
export function nextCandidateNodes(
  nodes: Record<string, StoryNode>,
  current: StoryNode | undefined | null,
): StoryNode[] {
  if (!current || !current.question) return [];
  const seen = new Set<string>();
  const out: StoryNode[] = [];
  for (const c of current.question.choices) {
    if (c.next && nodes[c.next] && !seen.has(c.next)) {
      seen.add(c.next);
      out.push(nodes[c.next]);
    }
  }
  return out;
}
