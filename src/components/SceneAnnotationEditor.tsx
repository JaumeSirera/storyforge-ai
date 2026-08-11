import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  saveSceneAnnotation,
  deleteSceneAnnotation,
  type SceneAnnotation,
} from "@/lib/scene-annotations.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, NotebookPen, Save, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const SUGGESTED_TAGS = [
  "Fortaleza",
  "A mejorar",
  "Seguimiento",
  "Evidencia clave",
  "Comunicación",
  "Liderazgo",
  "Trabajo en equipo",
  "Gestión del conflicto",
];

type Props = {
  captureSessionId: string;
  sceneIndex: number;
  sceneTitle: string;
  startSec: number;
  endSec: number;
  annotation: SceneAnnotation | null;
};

/** Editor de notas y etiquetas para una escena de la película resumen. */
export function SceneAnnotationEditor({
  captureSessionId,
  sceneIndex,
  sceneTitle,
  startSec,
  endSec,
  annotation,
}: Props) {
  const qc = useQueryClient();
  const save = useServerFn(saveSceneAnnotation);
  const remove = useServerFn(deleteSceneAnnotation);

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(annotation?.note ?? "");
  const [tags, setTags] = useState<string[]>(annotation?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNote(annotation?.note ?? "");
    setTags(annotation?.tags ?? []);
  }, [annotation?.id, annotation?.updatedAt]);

  const dirty = useMemo(() => {
    const base = annotation ?? { note: "", tags: [] as string[] };
    return (
      note.trim() !== (base.note ?? "").trim() ||
      tags.join("|") !== (base.tags ?? []).join("|")
    );
  }, [annotation, note, tags]);

  function addTag(value: string) {
    const t = value.trim();
    if (!t) return;
    setTags((prev) => (prev.some((x) => x.toLowerCase() === t.toLowerCase()) ? prev : [...prev, t].slice(0, 20)));
    setTagDraft("");
  }

  async function invalidate() {
    await qc.invalidateQueries({ queryKey: ["scene-annotations", captureSessionId] });
  }

  async function onSave() {
    setBusy(true);
    try {
      await save({
        data: { captureSessionId, sceneIndex, sceneTitle, startSec, endSec, note, tags },
      });
      await invalidate();
      toast.success("Anotación guardada");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar la anotación");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await remove({ data: { captureSessionId, sceneIndex } });
      setNote("");
      setTags([]);
      await invalidate();
      toast.success("Anotación eliminada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar la anotación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <NotebookPen className="h-3.5 w-3.5" /> Mis notas y etiquetas
        </p>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cerrar" : annotation ? "Editar" : "Añadir nota"}
        </Button>
      </div>

      {!open && (
        <div className="mt-2 space-y-2">
          {annotation ? (
            <>
              {annotation.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {annotation.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" aria-hidden="true" />
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
              {annotation.note && <p className="whitespace-pre-wrap text-sm">{annotation.note}</p>}
              <p className="text-[11px] text-muted-foreground">
                Actualizada el {new Date(annotation.updatedAt).toLocaleString("es-ES")}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sin anotaciones todavía. Añade observaciones propias y etiquetas para revisarlas junto a
              la transcripción.
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`scene-note-${sceneIndex}`}>Nota</Label>
            <Textarea
              id={`scene-note-${sceneIndex}`}
              value={note}
              maxLength={4000}
              rows={4}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej.: reformula la objeción del cliente y propone alternativa en 12 s…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`scene-tag-${sceneIndex}`}>Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                id={`scene-tag-${sceneIndex}`}
                value={tagDraft}
                maxLength={40}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagDraft);
                  }
                }}
                placeholder="Escribe y pulsa Enter"
              />
              <Button type="button" variant="outline" onClick={() => addTag(tagDraft)}>
                Añadir
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`Quitar etiqueta ${t}`}
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      className="rounded-full hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTED_TAGS.filter(
                (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="gap-2" disabled={busy || !dirty} onClick={onSave}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </Button>
            {annotation && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-2 text-destructive"
                disabled={busy}
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
