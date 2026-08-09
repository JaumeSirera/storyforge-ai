import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { generateSimulation } from "@/lib/simulations.functions";
import { listPracticeAreas, createPracticeArea, type PracticeArea } from "@/lib/areas.functions";
import { extractDocumentText } from "@/lib/document-parse.functions";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AI_MODELS, DEFAULT_AI_MODEL, type AiModelId } from "@/lib/ai-models";
import { Plus, Trash2, Sparkles, Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED = ".pdf,.docx,.pptx,.txt,.md";
const MAX_BYTES = 10 * 1024 * 1024;
const DRAFT_KEY = "new-simulation-draft-v1";


type Draft = {
  title: string;
  objective: string;
  topic: string;
  duration: number;
  prompt: string;
  videos: VideoEntry[];
  lastFile: string | null;
  model: AiModelId;
};

export const Route = createFileRoute("/_authenticated/app/new")({
  component: NewSimulation,
});

type VideoEntry = { label: string; type: "youtube" | "vimeo" | "mp4"; url: string };

function detectType(url: string): "youtube" | "vimeo" | "mp4" {
  if (/youtu\.?be/.test(url)) return "youtube";
  if (/vimeo\.com/.test(url)) return "vimeo";
  return "mp4";
}

function getErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "");
  if (/Payment Required/i.test(message)) {
    return "No hay créditos disponibles para generar con IA. Añade créditos al espacio de trabajo o inténtalo más tarde.";
  }
  return message || "Error al generar";
}

function NewSimulation() {
  const navigate = useNavigate();
  const generate = useServerFn(generateSimulation);
  const extractDoc = useServerFn(extractDocumentText);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState(15);
  const [prompt, setPrompt] = useState("");
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [lastFile, setLastFile] = useState<string | null>(null);
  const [model, setModel] = useState<AiModelId>(DEFAULT_AI_MODEL);
  const [hydrated, setHydrated] = useState(false);
  const [areaKey, setAreaKey] = useState("");
  const [addingArea, setAddingArea] = useState(false);
  const [newArea, setNewArea] = useState("");
  const [savingArea, setSavingArea] = useState(false);
  const listAreas = useServerFn(listPracticeAreas);
  const createArea = useServerFn(createPracticeArea);
  const areas = useQuery({ queryKey: ["practice-areas"], queryFn: () => listAreas() });


  // Restore draft from localStorage on mount so edits survive reloads / HMR.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        if (typeof d.title === "string") setTitle(d.title);
        if (typeof d.objective === "string") setObjective(d.objective);
        if (typeof d.topic === "string") setTopic(d.topic);
        if (typeof d.duration === "number") setDuration(d.duration);
        if (typeof d.prompt === "string") setPrompt(d.prompt);
        if (Array.isArray(d.videos)) setVideos(d.videos);
        if (typeof d.lastFile === "string" || d.lastFile === null)
          setLastFile(d.lastFile ?? null);
        if (typeof d.model === "string" && AI_MODELS.some((m) => m.id === d.model))
          setModel(d.model as AiModelId);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist the draft on any change (after the initial hydrate).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const draft: Draft = { title, objective, topic, duration, prompt, videos, lastFile, model };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore quota errors */
    }
  }, [hydrated, title, objective, topic, duration, prompt, videos, lastFile, model]);

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setTitle("");
    setObjective("");
    setTopic("");
    setDuration(15);
    setPrompt("");
    setVideos([]);
    setLastFile(null);
    setModel(DEFAULT_AI_MODEL);
    toast.success("Borrador descartado");
  }



  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("El archivo supera los 10 MB");
      return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await extractDoc({ data: fd });
      setPrompt((prev) => {
        const header = `--- ${result.filename} ---\n`;
        const block = header + result.text;
        return prev.trim() ? `${prev.trim()}\n\n${block}` : block;
      });
      setLastFile(result.filename);
      toast.success(
        result.truncated
          ? `Texto importado (recortado a ${result.chars.toLocaleString()} caracteres)`
          : `Texto importado (${result.chars.toLocaleString()} caracteres)`,
      );
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo leer el archivo");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }



  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva simulación</h1>
        <p className="text-muted-foreground mt-1">
          La IA generará el guion, las preguntas, las ramas y los criterios de evaluación.
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            const result = await generate({
              data: {
                title,
                objective,
                prompt,
                topic: topic || undefined,
                areaKey: areaKey || undefined,
                areaLabel:
                  (areas.data ?? []).find((a: PracticeArea) => a.key === areaKey)?.label ||
                  undefined,
                durationMin: duration,
                videos,
                model,
              },

            });
            if (!result?.id) throw new Error("No se pudo crear la simulación");
            toast.success("¡Simulación generada!");
            try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
            navigate({ to: "/app/simulations/$id", params: { id: result.id } });
          } catch (err: any) {
            toast.error(getErrorMessage(err));
          } finally {
            setLoading(false);
          }
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>1. Objetivo</CardTitle>
            <CardDescription>¿Qué quieres evaluar o enseñar?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Selección de Chef Ejecutivo - Hotel 5 estrellas" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj">Objetivo</Label>
              <Input id="obj" required value={objective} onChange={(e) => setObjective(e.target.value)}
                placeholder="Evaluar capacidad de liderazgo, gestión de crisis y conocimiento técnico" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Área de aplicación</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setAddingArea((v) => !v)}
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir nueva área
                </Button>
              </div>
              <Select value={areaKey} onValueChange={setAreaKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un área (entrevistas, terapia grupal…)" />
                </SelectTrigger>
                <SelectContent>
                  {(areas.data ?? []).map((a: PracticeArea) => (
                    <SelectItem key={a.id} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addingArea && (
                <div className="flex gap-2 pt-1">
                  <Input
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="Nombre del área (ej: Onboarding técnico)"
                    maxLength={120}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingArea}
                    onClick={async () => {
                      if (newArea.trim().length < 2) {
                        toast.error("Indica el nombre del área");
                        return;
                      }
                      setSavingArea(true);
                      try {
                        const created = await createArea({ data: { label: newArea.trim() } });
                        setNewArea("");
                        setAddingArea(false);
                        await areas.refetch();
                        setAreaKey(created.key);
                        toast.success("Área añadida");
                      } catch (err: any) {
                        toast.error(err?.message ?? "No se pudo crear el área");
                      } finally {
                        setSavingArea(false);
                      }
                    }}
                  >
                    {savingArea ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="topic">Tema/sector (opcional)</Label>
                <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="Hostelería, RRHH, Industria..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dur">Duración objetivo (min)</Label>
                <Input id="dur" type="number" min={5} max={60} value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
            </div>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>2. Guion / contexto</CardTitle>
                <CardDescription>
                  Describe la situación, personajes y retos. Puedes pegar texto o importar un documento.
                </CardDescription>
              </div>
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={parsing}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  {parsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {parsing ? "Leyendo..." : "Importar documento"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              required
              minLength={20}
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Buscamos un chef ejecutivo. Primer día de trabajo, llega un imprevisto con el proveedor de pescado fresco. Debe gestionar personal, compras, calidad y resolver conflictos..."
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              Formatos: PDF, DOCX, PPTX, TXT, MD · Máx. 10 MB
              {lastFile && <span className="ml-1">· Último: {lastFile}</span>}
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>3. Vídeos (opcional)</CardTitle>
                <CardDescription>Enlaza vídeos de YouTube, Vimeo o un MP4 público.</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setVideos((v) => [...v, { label: "", type: "youtube", url: "" }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Añadir vídeo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {videos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Puedes generar sin vídeos: la IA creará escenas narradas. Añade vídeos para asociarlos a escenas.
              </p>
            )}
            {videos.map((v, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-4"
                  placeholder="Etiqueta (ej: Llegada al hotel)"
                  value={v.label}
                  onChange={(e) =>
                    setVideos((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <Input
                  className="col-span-7"
                  placeholder="https://..."
                  required
                  value={v.url}
                  onChange={(e) =>
                    setVideos((arr) =>
                      arr.map((x, j) =>
                        j === i ? { ...x, url: e.target.value, type: detectType(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setVideos((arr) => arr.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Modelo de IA</CardTitle>
            <CardDescription>
              Elige el modelo. Los más potentes generan mejores guiones pero consumen más créditos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select value={model} onValueChange={(v) => setModel(v as AiModelId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>


        <div className="flex justify-between items-center gap-2">
          <Button type="button" variant="ghost" onClick={clearDraft} disabled={loading}>
            Descartar borrador
          </Button>
          <Button type="submit" size="lg" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Generando con IA..." : "Generar con IA"}
          </Button>
        </div>
      </form>
    </div>
  );
}
