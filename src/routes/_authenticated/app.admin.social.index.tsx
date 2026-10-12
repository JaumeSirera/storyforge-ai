import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { deleteSocialStory, generateSocialStory, listSocialStories } from "@/lib/social.functions";
import { extractDocumentText } from "@/lib/document-parse.functions";
import { FREQUENCIES, SOCIAL_NETWORKS, networkName, type SocialNetworkId } from "@/lib/social-shared";

export const Route = createFileRoute("/_authenticated/app/admin/social/")({
  component: StudioPage,
});

function StudioPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listSocialStories);
  const generate = useServerFn(generateSocialStory);
  const remove = useServerFn(deleteSocialStory);
  const extract = useServerFn(extractDocumentText);

  const stories = useQuery({ queryKey: ["social-stories"], queryFn: () => list(), retry: 1 });

  const [source, setSource] = useState("");
  const [title, setTitle] = useState("");
  const [tone, setTone] = useState("");
  const [count, setCount] = useState(5);
  const [everyDays, setEveryDays] = useState(7);
  const [networks, setNetworks] = useState<SocialNetworkId[]>(["linkedin", "facebook"]);
  const [reading, setReading] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      generate({ data: { sourceText: source, chapterCount: count, title, tone, networks, everyDays } }),
    onSuccess: (res) => {
      toast.success(`Serie creada con ${res.chapters.length} capítulos`);
      qc.invalidateQueries({ queryKey: ["social-stories"] });
      navigate({ to: "/app/admin/social/$id", params: { id: res.story.id } });
    },
    onError: (e: Error) => toast.error("No se pudo generar la serie", { description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-stories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await extract({ data: fd });
      setSource(res.text);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      toast.error("No se pudo leer el archivo", { description: (e as Error).message });
    } finally {
      setReading(false);
    }
  }

  const toggle = (id: SocialNetworkId) =>
    setNetworks((cur) => (cur.includes(id) ? cur.filter((n) => n !== id) : [...cur, id]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Nueva serie</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="src">Material de origen</Label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary hover:underline">
              {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
              Subir PDF, Word, PowerPoint o texto
              <input type="file" className="sr-only" accept=".pdf,.docx,.pptx,.txt,.md" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>
          <Textarea id="src" rows={9} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Pega aquí el texto. La IA lo dividirá en capítulos sin inventar nada." />
          <p className="text-xs text-muted-foreground">{source.length.toLocaleString("es-ES")} caracteres</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="t">Título (opcional)</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="tone">Tono (opcional)</Label><Input id="tone" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Cercano, profesional…" /></div>
          <div className="space-y-1.5"><Label htmlFor="n">Capítulos</Label><Input id="n" type="number" min={1} max={30} value={count} onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="f">Frecuencia</Label>
            <select id="f" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={everyDays} onChange={(e) => setEveryDays(Number(e.target.value))}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Redes</Label>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_NETWORKS.map((n) => (
              <button key={n.id} type="button" onClick={() => toggle(n.id)} aria-pressed={networks.includes(n.id)}
                className={`rounded-full border px-3 py-1 text-xs ${networks.includes(n.id) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {n.name}
              </button>
            ))}
          </div>
        </div>
        <Button className="w-full gap-2" disabled={source.trim().length < 80 || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {create.isPending ? "Generando con tu IA…" : "Generar capítulos"}
        </Button>
        {source.trim().length > 0 && source.trim().length < 80 && <p className="text-xs text-muted-foreground">Añade al menos 80 caracteres de material.</p>}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Tus series</h3>
        {stories.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {stories.error && <p className="text-sm text-destructive">{(stories.error as Error).message}</p>}
        {stories.data?.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay series. Crea la primera a la izquierda.</p>}
        {stories.data?.map((s) => (
          <div key={s.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Link to="/app/admin/social/$id" params={{ id: s.id }} className="min-w-0 flex-1">
              <div className="font-medium truncate hover:underline">{s.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {s.chapters} capítulos · {s.published} publicados · {s.scheduled} programados{s.errors ? ` · ${s.errors} con error` : ""}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.networks.length ? s.networks.map((n) => <Badge key={n} variant="secondary">{networkName(n)}</Badge>) : <span className="text-xs text-muted-foreground">Sin redes activas</span>}
              </div>
            </Link>
            <Button variant="ghost" size="icon" aria-label="Eliminar serie" onClick={() => { if (confirm(`¿Eliminar «${s.title}»?`)) del.mutate(s.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
