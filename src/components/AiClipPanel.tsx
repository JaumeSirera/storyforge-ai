import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startAiVideoGeneration, pollAiVideoGeneration } from "@/lib/ai-video.functions";
import { listCharacters, createCharacter, deleteCharacter, generateCharacterImage, type CharacterDTO } from "@/lib/characters.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Cog,
  UploadCloud,
  UserPlus,
  Trash2,
  ImagePlus,
  Wand2,
} from "lucide-react";
import type { JobStage } from "@/lib/ai-video.functions";
import type { VideoSource } from "@/lib/story-types";

interface JobProgress {
  stage: JobStage;
  progress: number;
  logsTail?: string;
  elapsedSec?: number;
  error?: string;
}

const STAGE_META: Record<JobStage, { label: string; Icon: typeof Loader2; tone: string }> = {
  queued:    { label: "En cola",     Icon: Clock,       tone: "text-muted-foreground" },
  running:   { label: "Generando",   Icon: Cog,         tone: "text-primary" },
  uploading: { label: "Subiendo",    Icon: UploadCloud, tone: "text-primary" },
  finished:  { label: "Finalizado",  Icon: CheckCircle2, tone: "text-emerald-600" },
  failed:    { label: "Fallido",     Icon: XCircle,     tone: "text-destructive" },
};

function fmtElapsed(sec?: number) {
  if (!sec || sec < 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const COST_PER_SECOND_USD = 0.05;
function estimateCostUsd(durationSec: number) {
  return +(durationSec * COST_PER_SECOND_USD).toFixed(3);
}
function fmtUsd(usd: number) {
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`;
}

type AiSource = Extract<VideoSource, { type: "ai" }>;

interface Props {
  simulationId: string;
  source: AiSource;
  onChange: (patch: Partial<AiSource>) => void;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AiClipPanel({ simulationId, source, onChange }: Props) {
  const start = useServerFn(startAiVideoGeneration);
  const poll = useServerFn(pollAiVideoGeneration);
  const listFn = useServerFn(listCharacters);
  const createFn = useServerFn(createCharacter);
  const deleteFn = useServerFn(deleteCharacter);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(source.prompt ?? "");
  const [durationSec, setDurationSec] = useState<5 | 10>((source.durationSec as 5 | 10) ?? 5);
  const [characterId, setCharacterId] = useState<string | null>(source.characterId ?? null);
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);

  // New character form
  const [newCharOpen, setNewCharOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newConsent, setNewConsent] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const charsQuery = useQuery({
    queryKey: ["characters"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const [progress, setProgress] = useState<JobProgress | null>(
    source.status === "pending"
      ? { stage: "queued", progress: 5 }
      : source.status === "failed"
      ? { stage: "failed", progress: 0, error: source.error }
      : source.status === "ready"
      ? { stage: "finished", progress: 100 }
      : null,
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (source.status !== "pending" || !source.predictionId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await poll({
          data: { predictionId: source.predictionId!, simulationId },
        });
        if (cancelled) return;
        if (res.status === "ready") {
          setProgress({ stage: "finished", progress: 100, elapsedSec: res.elapsedSec });
          onChange({ status: "ready", url: res.url, storagePath: res.storagePath });
          toast.success("Vídeo generado con IA");
          return;
        }
        if (res.status === "failed") {
          setProgress({ stage: "failed", progress: 0, error: res.error, logsTail: res.logsTail });
          onChange({ status: "failed", error: res.error });
          toast.error(`Generación fallida: ${res.error}`);
          return;
        }
        setProgress({
          stage: res.stage,
          progress: res.progress,
          logsTail: res.logsTail,
          elapsedSec: res.elapsedSec,
        });
      } catch (err: any) {
        console.warn("poll error", err?.message);
      }
      timerRef.current = setTimeout(tick, 6000);
    };

    timerRef.current = setTimeout(tick, 4000);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [source.status, source.predictionId, simulationId, poll, onChange]);

  const handleStart = async () => {
    if (!consent) {
      toast.error("Debes confirmar el consentimiento antes de generar.");
      return;
    }
    setStarting(true);
    try {
      const chosen = charsQuery.data?.find((c) => c.id === characterId);
      const res = await start({
        data: {
          prompt: prompt.trim(),
          durationSec,
          aspectRatio: "16:9",
          ...(characterId ? { characterId } : {}),
        },
      });
      onChange({
        status: "pending",
        predictionId: res.predictionId,
        prompt: prompt.trim(),
        durationSec,
        url: null,
        error: undefined,
        characterId: characterId ?? undefined,
        characterName: chosen?.name,
        referenceImageUrl: chosen?.imageUrl,
      });
      setOpen(false);
      toast.info(
        characterId
          ? "Generación iniciada con imagen de personaje (i2v)."
          : "Generación iniciada. Puede tardar 1-3 minutos.",
      );
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo iniciar la generación");
    } finally {
      setStarting(false);
    }
  };

  const handleCreateCharacter = async () => {
    if (!newFile) return toast.error("Selecciona una imagen");
    if (!newName.trim()) return toast.error("Escribe un nombre");
    if (!newConsent) return toast.error("Confirma el consentimiento");
    if (newFile.size > 8 * 1024 * 1024) return toast.error("Imagen > 8 MB");
    setCreating(true);
    try {
      const dataUrl = await fileToDataUrl(newFile);
      const created = await createFn({
        data: {
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          consent: true,
          imageDataUrl: dataUrl,
        },
      });
      await qc.invalidateQueries({ queryKey: ["characters"] });
      setCharacterId(created.id);
      setNewCharOpen(false);
      setNewName("");
      setNewDesc("");
      setNewFile(null);
      setNewConsent(false);
      toast.success("Personaje guardado");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo guardar el personaje");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm("¿Eliminar este personaje?")) return;
    try {
      await deleteFn({ data: { id } });
      if (characterId === id) setCharacterId(null);
      await qc.invalidateQueries({ queryKey: ["characters"] });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">Vídeo generado con IA</span>
          {source.status === "pending" && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Generando…
            </span>
          )}
          {source.status === "ready" && (
            <span className="ml-auto text-xs text-emerald-600">Listo</span>
          )}
          {source.status === "failed" && (
            <span className="ml-auto text-xs text-destructive">Fallido</span>
          )}
        </div>
        {source.prompt && (
          <p className="text-xs text-muted-foreground line-clamp-3">“{source.prompt}”</p>
        )}
        {source.characterName && (
          <div className="flex items-center gap-2 text-xs">
            {source.referenceImageUrl && (
              <img src={source.referenceImageUrl} alt="" className="h-8 w-8 rounded object-cover border" />
            )}
            <span className="text-muted-foreground">
              Personaje: <span className="font-medium text-foreground">{source.characterName}</span>
            </span>
          </div>
        )}
        {typeof source.durationSec === "number" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Duración: <span className="font-medium text-foreground">{source.durationSec}s</span></span>
            <span>·</span>
            <span>
              Coste estimado:{" "}
              <span className="font-medium text-foreground">{fmtUsd(estimateCostUsd(source.durationSec))}</span>
            </span>
          </div>
        )}

        {progress && (source.status === "pending" || source.status === "failed" || source.status === "ready") && (
          <div className="rounded-md border bg-background/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              {(() => {
                const meta = STAGE_META[progress.stage];
                const Icon = meta.Icon;
                const spinning = progress.stage === "queued" || progress.stage === "running" || progress.stage === "uploading";
                return (
                  <>
                    <Icon className={`h-3.5 w-3.5 ${meta.tone} ${spinning ? "animate-spin" : ""}`} />
                    <span className={`font-medium ${meta.tone}`}>{meta.label}</span>
                    <Badge variant="outline" className="ml-1 py-0 text-[10px]">
                      {progress.progress}%
                    </Badge>
                    {typeof progress.elapsedSec === "number" && (
                      <span className="ml-auto text-muted-foreground">{fmtElapsed(progress.elapsedSec)}</span>
                    )}
                  </>
                );
              })()}
            </div>
            <Progress value={progress.progress} className="h-1.5" />
            {progress.logsTail && (
              <pre className="max-h-24 overflow-auto rounded bg-muted/60 p-1.5 text-[10px] leading-tight text-muted-foreground whitespace-pre-wrap">
                {progress.logsTail}
              </pre>
            )}
            {progress.error && (
              <p className="text-xs text-destructive">{progress.error}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            {source.status === "ready" ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1" /> Regenerar
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                {source.status === "pending" ? "Reconfigurar" : "Configurar y generar"}
              </>
            )}
          </Button>
          {source.status === "ready" && source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline self-center"
            >
              Abrir vídeo
            </a>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generar vídeo con IA</DialogTitle>
            <DialogDescription>
              Describe la escena. Opcionalmente añade un personaje de referencia (imagen) para que la IA
              lo use como primer fotograma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descripción de la escena</Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ej. Un comercial saluda al cliente en una oficina moderna, plano medio, luz natural..."
              />
            </div>

            {/* Character gallery */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Personaje de referencia (opcional)</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewCharOpen((v) => !v)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  {newCharOpen ? "Cerrar" : "Añadir personaje"}
                </Button>
              </div>

              {newCharOpen && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre</Label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ana comercial" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Imagen (JPG/PNG, ≤ 8 MB)</Label>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descripción (opcional)</Label>
                    <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Mujer 30 años, chaqueta azul" />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 mt-0.5"
                      checked={newConsent}
                      onChange={(e) => setNewConsent(e.target.checked)}
                    />
                    <span>Tengo el consentimiento por escrito de esta persona para usar su imagen en vídeos generados por IA.</span>
                  </label>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={handleCreateCharacter} disabled={creating}>
                      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImagePlus className="h-3.5 w-3.5 mr-1" />}
                      Guardar personaje
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setCharacterId(null)}
                  className={`rounded-md border p-2 text-xs text-left ${
                    characterId === null ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="h-16 flex items-center justify-center text-muted-foreground">
                    Sin personaje
                  </div>
                  <div className="mt-1 text-center text-[11px]">Texto → vídeo</div>
                </button>
                {(charsQuery.data ?? []).map((c: CharacterDTO) => (
                  <div key={c.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setCharacterId(c.id)}
                      className={`w-full rounded-md border p-1.5 text-xs text-left ${
                        characterId === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.name} className="h-16 w-full object-cover rounded" />
                      ) : (
                        <div className="h-16 bg-muted rounded" />
                      )}
                      <div className="mt-1 truncate text-center text-[11px] font-medium">{c.name}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCharacter(c.id)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-background/90 border rounded p-0.5"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
              {charsQuery.isLoading && (
                <p className="text-[11px] text-muted-foreground">Cargando personajes…</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {characterId
                  ? "Modelo: wan-2.2-i2v-fast (image-to-video). La imagen se usará como primer fotograma."
                  : "Modelo: wan-2.2-t2v-fast (text-to-video)."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duración</Label>
                <Select value={String(durationSec)} onValueChange={(v) => setDurationSec(Number(v) as 5 | 10)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 segundos</SelectItem>
                    <SelectItem value="10">10 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Coste estimado</span>
                <span className="font-semibold">{fmtUsd(estimateCostUsd(durationSec))}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                ~{fmtUsd(COST_PER_SECOND_USD)}/segundo generado. El coste real puede variar.
              </p>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Confirmo que tengo los derechos y consentimientos necesarios sobre las personas y
                marcas descritas en el prompt/imagen.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleStart} disabled={starting || prompt.trim().length < 5}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
