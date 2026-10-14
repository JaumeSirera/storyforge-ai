import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Film, ImagePlus, Link2, Loader2, Play, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  addSocialChapter,
  deleteSocialChapter,
  getSocialStory,
  publishSocialChapterNow,
  scheduleSocialStory,
  socialMediaUrl,
  updateSocialChapter,
  updateSocialStory,
} from "@/lib/social.functions";
import { uploadFile } from "@/lib/upload-file";
import { getCurrentUser } from "@/lib/current-user";
import {
  FREQUENCIES,
  SOCIAL_NETWORKS,
  STATUS_LABEL,
  composePost,
  type SocialChapter,
  type SocialStoryFull,
} from "@/lib/social-shared";

export const Route = createFileRoute("/_authenticated/app/admin/social/$id")({
  component: StoryEditor,
});

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function StoryEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchStory = useServerFn(getSocialStory);
  const q = useQuery({ queryKey: ["social-story", id], queryFn: () => fetchStory({ data: { id } }), retry: 1 });
  const setData = (d: SocialStoryFull) => {
    qc.setQueryData(["social-story", id], d);
    qc.invalidateQueries({ queryKey: ["social-stories"] });
    qc.invalidateQueries({ queryKey: ["social-queue"] });
  };

  const updStory = useServerFn(updateSocialStory);
  const add = useServerFn(addSocialChapter);
  const schedule = useServerFn(scheduleSocialStory);

  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() + 3600_000).toISOString()));
  const [everyDays, setEveryDays] = useState(7);
  useEffect(() => {
    if (q.data) {
      setTitle(q.data.story.title);
      setEveryDays(q.data.story.every_days);
    }
  }, [q.data?.story.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = useMutation({
    mutationFn: () => updStory({ data: { id, title } }),
    onSuccess: setData,
    onError: (e: Error) => toast.error(e.message),
  });
  const addCh = useMutation({ mutationFn: () => add({ data: { storyId: id } }), onSuccess: setData });
  const sched = useMutation({
    mutationFn: () => schedule({ data: { id, startAt: new Date(startAt).toISOString(), everyDays } }),
    onSuccess: (d) => { setData(d); toast.success("Capítulos programados"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Serie no encontrada"}</p>;
  const { story, chapters } = q.data;

  return (
    <div className="space-y-5">
      <Link to="/app/admin/social" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al estudio
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="title">Título de la serie</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button variant="outline" disabled={!title.trim() || title === story.title || saveTitle.isPending} onClick={() => saveTitle.mutate()}>Guardar título</Button>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-muted-foreground">Redes:</span>
          {story.networks.length ? story.networks.map((n) => <Badge key={n} variant="secondary">{SOCIAL_NETWORKS.find((x) => x.id === n)?.name ?? n}</Badge>) : <span className="text-muted-foreground">ninguna</span>}
          <Link to="/app/admin/social/networks" className="text-primary hover:underline">Cambiar</Link>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="start">Primera publicación</Label>
            <Input id="start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="freq">Frecuencia</Label>
            <select id="freq" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={everyDays} onChange={(e) => setEveryDays(Number(e.target.value))}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <Button className="gap-2" disabled={!startAt || sched.isPending} onClick={() => sched.mutate()}>
            {sched.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Programar serie
          </Button>
        </div>
      </div>

      {chapters.map((c, i) => (
        <ChapterCard key={c.id} index={i} chapter={c} storyId={id} networks={story.networks} onData={setData} />
      ))}

      <Button variant="outline" className="gap-2" onClick={() => addCh.mutate()} disabled={addCh.isPending}>
        <Plus className="h-4 w-4" /> Añadir capítulo
      </Button>
    </div>
  );
}

function ChapterCard({
  chapter,
  index,
  storyId,
  networks,
  onData,
}: {
  chapter: SocialChapter;
  index: number;
  storyId: string;
  networks: string[];
  onData: (d: SocialStoryFull) => void;
}) {
  const update = useServerFn(updateSocialChapter);
  const remove = useServerFn(deleteSocialChapter);
  const publish = useServerFn(publishSocialChapterNow);
  const mediaUrl = useServerFn(socialMediaUrl);

  const [title, setTitle] = useState(chapter.title);
  const [body, setBody] = useState(chapter.body);
  const [links, setLinks] = useState(chapter.links);
  const [when, setWhen] = useState(toLocalInput(chapter.scheduled_at));
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const m of chapter.media) {
        try { out[m.path] = (await mediaUrl({ data: { path: m.path } })).url; } catch { /* sin vista previa */ }
      }
      if (alive) setPreviews(out);
    })();
    return () => { alive = false; };
  }, [chapter.media.map((m) => m.path).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    title !== chapter.title ||
    body !== chapter.body ||
    JSON.stringify(links) !== JSON.stringify(chapter.links) ||
    when !== toLocalInput(chapter.scheduled_at);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: chapter.id,
          title,
          body,
          links: links.filter((l) => l.url.trim()),
          scheduledAt: when ? new Date(when).toISOString() : null,
        },
      }),
    onSuccess: (d) => { onData(d); toast.success("Capítulo guardado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: () => remove({ data: { id: chapter.id } }), onSuccess: onData });
  const pub = useMutation({
    mutationFn: () => publish({ data: { storyId, chapterId: chapter.id } }),
    onSuccess: (r) => {
      onData(r.story);
      if (r.status === "publicado") toast.success("Publicado en todas las redes");
      else toast.error("Hubo errores al publicar", { description: r.result, duration: 15000 });
    },
    onError: (e: Error) => toast.error("No se pudo publicar", { description: e.message }),
  });

  async function onUpload(file: File | undefined) {
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) return toast.error("El archivo supera 200 MB");
    setUploading(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Sesión no válida");
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${user.id}/social/${storyId}/${Date.now()}-${safe}`;
      await uploadFile("videos", path, file, { contentType: file.type });
      const kind = file.type.startsWith("video/") ? "video" : "imagen";
      const d = await update({ data: { id: chapter.id, media: [...chapter.media, { path, kind, name: file.name }] } });
      onData(d);
    } catch (e) {
      toast.error("No se pudo subir el archivo", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function removeMedia(path: string) {
    const d = await update({ data: { id: chapter.id, media: chapter.media.filter((m) => m.path !== path) } });
    onData(d);
  }

  const images = chapter.media.filter((m) => m.kind !== "video");
  const [making, setMaking] = useState<number | null>(null);
  async function makeSlideshow() {
    const urls = images.map((m) => previews[m.path]).filter(Boolean);
    if (urls.length !== images.length) return toast.error("Espera a que carguen las imágenes");
    setMaking(0);
    try {
      const { createSlideshow } = await import("@/lib/slideshow");
      const file = await createSlideshow(urls, { title: title.trim(), onProgress: (p) => setMaking(Math.round(p * 100)) });
      const user = await getCurrentUser();
      if (!user) throw new Error("Sesión no válida");
      const path = `${user.id}/social/${storyId}/${file.name}`;
      await uploadFile("videos", path, file, { contentType: file.type });
      // El vídeo sustituye a las imágenes (TikTok no admite mezclar ambos).
      const d = await update({ data: { id: chapter.id, media: [...chapter.media.filter((m) => m.kind === "video"), { path, kind: "video", name: file.name }] } });
      onData(d);
      toast.success("Presentación creada", { description: "Las imágenes se han convertido en un vídeo." });
    } catch (e) {
      toast.error("No se pudo crear la presentación", { description: (e as Error).message });
    } finally {
      setMaking(null);
    }
  }

  const post = composePost(body, links);
  const over = SOCIAL_NETWORKS.filter((n) => networks.includes(n.id) && post.length > n.limit);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-primary">Capítulo {index + 1}</span>
        <Badge variant={chapter.status === "error" ? "destructive" : chapter.status === "publicado" ? "default" : "secondary"}>{STATUS_LABEL[chapter.status]}</Badge>
        {chapter.published_at && <span className="text-xs text-muted-foreground">{new Date(chapter.published_at).toLocaleString("es-ES")}</span>}
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Eliminar capítulo" onClick={() => { if (confirm("¿Eliminar este capítulo?")) del.mutate(); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título del capítulo" />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="font-bold" aria-label="Negrita" title="Negrita: selecciona texto y pulsa"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const el = document.getElementById(`body-${chapter.id}`) as HTMLTextAreaElement | null;
            if (!el) return;
            const { selectionStart: a, selectionEnd: b } = el;
            if (a === b) return toast.info("Selecciona primero el texto que quieres en negrita");
            const sel = body.slice(a, b);
            const isBold = sel.startsWith("**") && sel.endsWith("**") && sel.length > 4;
            const next = body.slice(0, a) + (isBold ? sel.slice(2, -2) : `**${sel}**`) + body.slice(b);
            setBody(next);
          }}>B</Button>
        <span className="text-xs text-muted-foreground">Selecciona texto y pulsa <b>B</b>. Se publicará en negrita en todas las redes.</span>
      </div>
      <Textarea id={`body-${chapter.id}`} rows={7} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Texto del capítulo" />
      {/\*\*[\s\S]+?\*\*/.test(body) && (
        <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap"><span className="block text-xs text-muted-foreground mb-1">Así se verá:</span>{composePost(body, [])}</div>
      )}
      <p className={`text-xs ${over.length ? "text-destructive" : "text-muted-foreground"}`}>
        {post.length} caracteres{over.length ? ` · demasiado largo para ${over.map((n) => `${n.name} (${n.limit})`).join(", ")}` : ""}
      </p>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Enlaces</Label>
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Texto" value={l.label} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="max-w-[40%]" />
            <Input placeholder="https://…" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="Quitar enlace" onClick={() => setLinks(links.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
          </div>
        ))}
        {links.length < 10 && <Button variant="ghost" size="sm" className="gap-1" onClick={() => setLinks([...links, { label: "", url: "" }])}><Plus className="h-3.5 w-3.5" /> Añadir enlace</Button>}
      </div>

      <div className="space-y-2">
        <Label>Imágenes y vídeos</Label>
        <div className="flex flex-wrap gap-2">
          {chapter.media.map((m) => (
            <div key={m.path} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
              {previews[m.path] ? (
                m.kind === "video" ? (
                  <button type="button" aria-label={`Ver ${m.name}`} onClick={() => setPlaying(previews[m.path])} className="relative block h-full w-full">
                    <video src={`${previews[m.path]}#t=3`} preload="metadata" className="h-full w-full object-cover" muted playsInline />
                    <span className="absolute inset-0 grid place-items-center bg-background/20"><Play className="h-6 w-6 text-foreground" /></span>
                  </button>
                ) : <img src={previews[m.path]} alt={m.name} className="h-full w-full object-cover" />
              ) : <span className="p-1 text-[10px] text-muted-foreground">{m.name}</span>}
              <button type="button" aria-label={`Quitar ${m.name}`} onClick={() => removeMedia(m.path)} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <input type="file" className="sr-only" accept="image/*,video/*" disabled={uploading} onChange={(e) => onUpload(e.target.files?.[0])} />
          </label>
        </div>
        {images.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={making !== null} onClick={makeSlideshow}>
              {making !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
              {making !== null ? `Creando vídeo… ${making}%` : "Convertir imágenes en vídeo (YouTube)"}
            </Button>
            <span className="text-xs text-muted-foreground">Unos 3 segundos por imagen, con el título al principio. No cierres la página mientras se crea.</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`w-${chapter.id}`}>Fecha de publicación</Label>
          <Input id={`w-${chapter.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Guardar</Button>
          <Button className="gap-2" disabled={dirty || pub.isPending || !body.trim()} onClick={() => pub.mutate()} title={dirty ? "Guarda los cambios antes de publicar" : undefined}>
            {pub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar ahora
          </Button>
        </div>
      </div>
      {chapter.result && <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs text-muted-foreground">{chapter.result}</pre>}
      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Vídeo del capítulo</DialogTitle>
          {playing && <video src={playing} controls autoPlay playsInline className="w-full rounded-lg bg-muted" />}
          {playing && <a href={playing} target="_blank" rel="noreferrer" className="text-sm text-primary underline">Abrir en otra pestaña</a>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
