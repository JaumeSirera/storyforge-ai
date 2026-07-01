import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startAiVideoGeneration, pollAiVideoGeneration } from "@/lib/ai-video.functions";
import { generateClipDialogue, TTS_VOICES } from "@/lib/tts.functions";
import { startLipsync, pollLipsync, estimateLipsyncCostUsd } from "@/lib/lipsync.functions";
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
  Mic,
  Volume2,
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
  const generateCharFn = useServerFn(generateCharacterImage);
  const generateDialogueFn = useServerFn(generateClipDialogue);
  const qc = useQueryClient();

  const [generatingDialogue, setGeneratingDialogue] = useState(false);


  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(source.prompt ?? "");
  const [durationSec, setDurationSec] = useState<5 | 10>((source.durationSec as 5 | 10) ?? 5);
  const [characterIds, setCharacterIds] = useState<string[]>(
    source.characterId ? [source.characterId] : [],
  );
  const [useFirstAsReference, setUseFirstAsReference] = useState<boolean>(
    !!source.characterId,
  );
  const [consent, setConsent] = useState(false);
  const [starting, setStarting] = useState(false);

  // New character form
  const [newCharOpen, setNewCharOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newConsent, setNewConsent] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  // AI-generated preview
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiModel, setAiModel] = useState<"google/gemini-2.5-flash-image" | "google/gemini-3-pro-image">(
    "google/gemini-2.5-flash-image",
  );
  const [aiPreviewDataUrl, setAiPreviewDataUrl] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

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

  const selectedChars: CharacterDTO[] =
    (charsQuery.data ?? []).filter((c) => characterIds.includes(c.id));

  const buildCastPrefix = (chars: CharacterDTO[]): string => {
    if (chars.length === 0) return "";
    const parts = chars.map((c) => (c.description ? `${c.name} (${c.description})` : c.name));
    if (chars.length === 1) return `Protagonista: ${parts[0]}. `;
    return `Reparto (${chars.length} personas en escena): ${parts.join("; ")}. `;
  };

  const cast = selectedChars;
  const referenceChar: CharacterDTO | undefined =
    useFirstAsReference && cast.length >= 1 ? cast[0] : undefined;
  const composedPrompt = (buildCastPrefix(cast) + prompt.trim()).trim();

  const handleStart = async () => {
    if (!consent) {
      toast.error("Debes confirmar el consentimiento antes de generar.");
      return;
    }
    setStarting(true);
    try {
      const res = await start({
        data: {
          prompt: composedPrompt,
          durationSec,
          aspectRatio: "16:9",
          ...(referenceChar ? { characterId: referenceChar.id } : {}),
        },
      });
      onChange({
        status: "pending",
        predictionId: res.predictionId,
        prompt: composedPrompt,
        durationSec,
        url: null,
        error: undefined,
        characterId: referenceChar?.id,
        characterName:
          cast.length > 1
            ? `${cast.length} personajes${referenceChar ? ` (ref: ${referenceChar.name})` : ""}`
            : referenceChar?.name,
        referenceImageUrl: referenceChar?.imageUrl,
      });
      setOpen(false);
      toast.info(
        referenceChar
          ? `Generación iniciada con ${cast.length > 1 ? "reparto y " : ""}imagen de referencia (i2v).`
          : "Generación iniciada. Puede tardar 1-3 minutos.",
      );
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo iniciar la generación");
    } finally {
      setStarting(false);
    }
  };


  const handleCreateCharacter = async () => {
    const hasFile = !!newFile;
    const hasAi = !!aiPreviewDataUrl;
    if (!hasFile && !hasAi) return toast.error("Sube o genera una imagen");
    if (!newName.trim()) return toast.error("Escribe un nombre");
    if (!newConsent) return toast.error("Confirma el consentimiento / ficticio");
    if (hasFile && newFile!.size > 8 * 1024 * 1024) return toast.error("Imagen > 8 MB");
    setCreating(true);
    try {
      const dataUrl = hasAi ? aiPreviewDataUrl! : await fileToDataUrl(newFile!);
      const created = await createFn({
        data: {
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          consent: true,
          imageDataUrl: dataUrl,
        },
      });
      await qc.invalidateQueries({ queryKey: ["characters"] });
      setCharacterIds((prev) => (prev.includes(created.id) ? prev : [...prev, created.id]));
      setNewCharOpen(false);
      setNewName("");
      setNewDesc("");
      setNewFile(null);
      setNewConsent(false);
      setAiPreviewDataUrl(null);
      setAiPrompt("");
      toast.success("Personaje guardado");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo guardar el personaje");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateAiCharacter = async () => {
    if (aiPrompt.trim().length < 5) return toast.error("Describe el personaje (mín. 5 caracteres)");
    setGeneratingAi(true);
    try {
      const res = await generateCharFn({ data: { prompt: aiPrompt.trim(), model: aiModel } });
      setAiPreviewDataUrl(res.imageDataUrl);
      setNewFile(null);
      toast.success("Personaje generado. Revísalo y guárdalo si te gusta.");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo generar");
    } finally {
      setGeneratingAi(false);
    }
  };


  const handleDeleteCharacter = async (id: string) => {
    if (!confirm("¿Eliminar este personaje?")) return;
    try {
      await deleteFn({ data: { id } });
      setCharacterIds((prev) => prev.filter((x) => x !== id));
      await qc.invalidateQueries({ queryKey: ["characters"] });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo eliminar");
    }
  };

  const dialogue = source.dialogue;
  const [dialogueText, setDialogueText] = useState(dialogue?.text ?? "");
  const [voiceId, setVoiceId] = useState(dialogue?.voiceId ?? TTS_VOICES[0].id);

  const handleGenerateDialogue = async () => {
    if (dialogueText.trim().length < 2) {
      toast.error("Escribe el diálogo primero.");
      return;
    }
    const voice = TTS_VOICES.find((v) => v.id === voiceId) ?? TTS_VOICES[0];
    setGeneratingDialogue(true);
    onChange({
      dialogue: {
        text: dialogueText.trim(),
        voiceId: voice.id,
        voiceName: voice.name,
        status: "generating",
        audioUrl: null,
      },
    });
    try {
      const res = await generateDialogueFn({
        data: { simulationId, text: dialogueText.trim(), voiceId: voice.id },
      });
      onChange({
        dialogue: {
          text: dialogueText.trim(),
          voiceId: voice.id,
          voiceName: voice.name,
          status: "ready",
          audioUrl: res.audioUrl,
          audioPath: res.audioPath,
        },
      });
      toast.success("Voz generada y mezclada con el clip.");
    } catch (err: any) {
      onChange({
        dialogue: {
          text: dialogueText.trim(),
          voiceId: voice.id,
          voiceName: voice.name,
          status: "failed",
          error: err?.message ?? "Fallo",
          audioUrl: null,
        },
      });
      toast.error(err?.message ?? "No se pudo generar la voz");
    } finally {
      setGeneratingDialogue(false);
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

        {source.status === "ready" && (
          <div className="rounded-md border bg-background/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Mic className="h-3.5 w-3.5 text-primary" />
              Diálogo del personaje (voz IA)
              {dialogue?.status === "ready" && (
                <Badge variant="outline" className="ml-auto py-0 text-[10px] text-emerald-600 border-emerald-600/40">
                  Voz lista
                </Badge>
              )}
              {dialogue?.status === "generating" && (
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Generando voz…
                </span>
              )}
              {dialogue?.status === "failed" && (
                <Badge variant="outline" className="ml-auto py-0 text-[10px] text-destructive border-destructive/40">
                  Fallido
                </Badge>
              )}
            </div>
            <Textarea
              rows={2}
              value={dialogueText}
              onChange={(e) => setDialogueText(e.target.value)}
              placeholder="Ej. Buenos días, ¿en qué puedo ayudarle hoy?"
              className="text-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger className="h-8 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                      {v.hint ? ` — ${v.hint}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateDialogue}
                disabled={generatingDialogue || dialogueText.trim().length < 2}
              >
                {generatingDialogue ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 mr-1" />
                )}
                {dialogue?.status === "ready" ? "Regenerar voz" : "Generar voz"}
              </Button>
              {dialogue?.status === "ready" && dialogue.audioUrl && (
                <audio src={dialogue.audioUrl} controls className="h-8 max-w-[220px]" />
              )}
            </div>
            {dialogue?.error && (
              <p className="text-[11px] text-destructive">{dialogue.error}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              La voz se sincroniza con el clip mudo durante la reproducción (no hay lip-sync labial).
            </p>
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
                <div className="rounded-md border bg-muted/30 p-3 space-y-3">
                  {/* AI generation block */}
                  <div className="rounded-md border border-dashed bg-background/60 p-2.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Wand2 className="h-3.5 w-3.5 text-primary" />
                      Generar personaje ficticio con IA (gratis con tus créditos)
                    </div>
                    <Textarea
                      rows={2}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Ej. Hombre 45 años, latino, traje gris, ejecutivo, sonrisa amable. O varios: dos comerciales, hombre y mujer, hablando entre ellos."
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={aiModel} onValueChange={(v) => setAiModel(v as typeof aiModel)}>
                        <SelectTrigger className="h-8 w-auto text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="google/gemini-2.5-flash-image">Nano-banana (rápido, barato)</SelectItem>
                          <SelectItem value="google/gemini-3-pro-image">Gemini 3 Pro Image (calidad alta)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" onClick={handleGenerateAiCharacter} disabled={generatingAi}>
                        {generatingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                        Generar
                      </Button>
                      {aiPreviewDataUrl && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setAiPreviewDataUrl(null)}>
                          Descartar
                        </Button>
                      )}
                    </div>
                    {aiPreviewDataUrl && (
                      <img src={aiPreviewDataUrl} alt="Previsualización IA" className="max-h-48 rounded border object-contain" />
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Tip: para escenas con varios protagonistas, describe a todas las personas en el prompt (una sola imagen compuesta).
                    </p>
                  </div>

                  <div className="text-[11px] text-center text-muted-foreground">— o sube tu propia imagen —</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre</Label>
                      <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ana comercial" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Imagen propia (JPG/PNG, ≤ 8 MB)</Label>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          setNewFile(e.target.files?.[0] ?? null);
                          if (e.target.files?.[0]) setAiPreviewDataUrl(null);
                        }}
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
                    <span>
                      Confirmo que la imagen es de un personaje ficticio generado por IA, o que tengo el
                      consentimiento por escrito de las personas reales que aparecen en ella.
                    </span>
                  </label>
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={handleCreateCharacter} disabled={creating}>
                      {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImagePlus className="h-3.5 w-3.5 mr-1" />}
                      Guardar personaje
                    </Button>
                  </div>
                </div>
              )}


              {cast.length > 0 && (
                <div className="rounded-md border bg-primary/5 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Reparto seleccionado ({cast.length})
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-destructive"
                      onClick={() => setCharacterIds([])}
                    >
                      Quitar todos
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {cast.map((c) => c.name).join(" · ")}
                  </p>
                  {cast.length >= 1 && (
                    <label className="flex items-center gap-2 text-[11px] cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={useFirstAsReference}
                        onChange={(e) => setUseFirstAsReference(e.target.checked)}
                      />
                      <span>
                        Usar <b>{cast[0].name}</b> como imagen de referencia (primer fotograma)
                        {cast.length > 1 && <> — al resto se les describirá sólo en el prompt</>}
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setCharacterIds([])}
                  className={`rounded-md border p-2 text-xs text-left ${
                    characterIds.length === 0 ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="h-16 flex items-center justify-center text-muted-foreground">
                    Sin personajes
                  </div>
                  <div className="mt-1 text-center text-[11px]">Texto → vídeo</div>
                </button>
                {(charsQuery.data ?? []).map((c: CharacterDTO) => {
                  const idx = characterIds.indexOf(c.id);
                  const selected = idx >= 0;
                  const toggle = () =>
                    setCharacterIds((prev) =>
                      prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                    );
                  return (
                    <div key={c.id} className="relative group">
                      <button
                        type="button"
                        onClick={toggle}
                        className={`w-full rounded-md border p-1.5 text-xs text-left ${
                          selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                      >
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} className="h-16 w-full object-cover rounded" />
                        ) : (
                          <div className="h-16 bg-muted rounded" />
                        )}
                        <div className="mt-1 truncate text-center text-[11px] font-medium">{c.name}</div>
                        {selected && (
                          <div className="absolute top-1 left-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                            {idx + 1}
                          </div>
                        )}
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
                  );
                })}
              </div>
              {charsQuery.isLoading && (
                <p className="text-[11px] text-muted-foreground">Cargando personajes…</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {referenceChar
                  ? `Modelo: wan-2.2-i2v-fast (image-to-video). Referencia: ${referenceChar.name}.`
                  : "Modelo: wan-2.2-t2v-fast (text-to-video). El reparto se describe automáticamente en el prompt."}
              </p>

              {cast.length > 0 && (
                <div className="rounded-md border bg-muted/40 p-2 text-[11px]">
                  <div className="font-medium mb-1">Prompt final que se enviará:</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{composedPrompt || "(vacío)"}</p>
                </div>
              )}
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
