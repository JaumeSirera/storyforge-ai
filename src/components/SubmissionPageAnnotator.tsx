import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteAnnotation, saveAnnotation } from "@/lib/assessment-annotations.functions";
import {
  ANNOTATION_KINDS,
  ANNOTATION_KIND_LABELS,
  type AnnotationKind,
  type SubmissionAnnotation,
} from "@/lib/assessments-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface AnnotatorPage {
  path: string;
  url: string | null;
  mimeType: string;
  name: string;
}

interface Draft {
  id?: string;
  pagePath: string;
  pageIndex: number;
  kind: AnnotationKind;
  x: number;
  y: number;
  w: number;
  h: number;
  correction: string;
  comment: string;
}

const KIND_COLORS: Record<AnnotationKind, string> = {
  transcription: "border-primary bg-primary/10",
  handwriting: "border-amber-500 bg-amber-500/10",
  content: "border-emerald-500 bg-emerald-500/10",
};

/** Marcado de áreas sobre las páginas escaneadas, con corrección de transcripción y notas de grafismo. */
export function SubmissionPageAnnotator({
  submissionId,
  pages,
  annotations,
}: {
  submissionId: string;
  pages: AnnotatorPage[];
  annotations: SubmissionAnnotation[];
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveAnnotation);
  const remove = useServerFn(deleteAnnotation);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState<{ pageIndex: number; rect: Draft } | null>(null);
  const dragRef = useRef<{ pageIndex: number; startX: number; startY: number } | null>(null);

  const byPage = useMemo(() => {
    const map = new Map<number, SubmissionAnnotation[]>();
    for (const annotation of annotations) {
      const list = map.get(annotation.pageIndex) ?? [];
      list.push(annotation);
      map.set(annotation.pageIndex, list);
    }
    return map;
  }, [annotations]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["assessment-submission", submissionId] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: Draft) =>
      save({
        data: {
          ...(input.id ? { id: input.id } : {}),
          submissionId,
          pagePath: input.pagePath,
          pageIndex: input.pageIndex,
          kind: input.kind,
          x: input.x,
          y: input.y,
          w: input.w,
          h: input.h,
          correction: input.correction,
          comment: input.comment,
        },
      }),
    onSuccess: () => {
      toast.success("Marca guardada con la entrega");
      setDraft(null);
      setPending(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar la marca"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Marca eliminada");
      setDraft(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar la marca"),
  });

  const relative = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>, page: AnnotatorPage, index: number) => {
    if ((event.target as HTMLElement).dataset.annotation) return;
    const { x, y } = relative(event);
    dragRef.current = { pageIndex: index, startX: x, startY: y };
    setPending({
      pageIndex: index,
      rect: {
        pagePath: page.path,
        pageIndex: index,
        kind: "transcription",
        x,
        y,
        w: 0,
        h: 0,
        correction: "",
        comment: "",
      },
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = relative(event);
    setPending((prev) =>
      prev
        ? {
            ...prev,
            rect: {
              ...prev.rect,
              x: Math.min(drag.startX, x),
              y: Math.min(drag.startY, y),
              w: Math.abs(x - drag.startX),
              h: Math.abs(y - drag.startY),
            },
          }
        : prev,
    );
  };

  const onPointerUp = () => {
    const current = pending;
    dragRef.current = null;
    if (!current) return;
    if (current.rect.w < 0.01 || current.rect.h < 0.01) {
      setPending(null);
      return;
    }
    setDraft(current.rect);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Páginas de la entrega y marcas del evaluador</CardTitle>
        <CardDescription>
          Arrastra sobre una página para marcar un área y añade la transcripción correcta o una nota de
          grafismo. Las marcas se guardan con la entrega y se aplican al volver a corregir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pages.map((page, index) => {
          const marks = byPage.get(index) ?? [];
          return (
            <div key={page.path} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">
                  Página {index + 1} · {page.name}
                </p>
                <Badge variant="secondary">{marks.length} marca(s)</Badge>
              </div>

              {page.mimeType === "application/pdf" || !page.url ? (
                <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                  {page.url ? (
                    <a href={page.url} target="_blank" rel="noreferrer" className="underline">
                      Abrir {page.name} (PDF)
                    </a>
                  ) : (
                    "Página no disponible"
                  )}
                  <p className="mt-1 text-xs">El marcado por áreas está disponible en páginas de imagen.</p>
                </div>
              ) : (
                <div
                  className="relative touch-none select-none overflow-hidden rounded-md border border-border"
                  onPointerDown={(e) => onPointerDown(e, page, index)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  role="application"
                  aria-label={`Marcar áreas en la página ${index + 1}`}
                >
                  <img
                    src={page.url}
                    alt={`Página escaneada: ${page.name}`}
                    loading="lazy"
                    draggable={false}
                    className="w-full object-contain"
                  />
                  {marks.map((mark, markIndex) => (
                    <button
                      key={mark.id}
                      type="button"
                      data-annotation="1"
                      onClick={() =>
                        setDraft({
                          id: mark.id,
                          pagePath: mark.pagePath,
                          pageIndex: mark.pageIndex,
                          kind: mark.kind,
                          x: mark.x,
                          y: mark.y,
                          w: mark.w,
                          h: mark.h,
                          correction: mark.correction,
                          comment: mark.comment,
                        })
                      }
                      title={`${ANNOTATION_KIND_LABELS[mark.kind]}: ${mark.correction || mark.comment}`}
                      aria-label={`Editar marca ${markIndex + 1}: ${ANNOTATION_KIND_LABELS[mark.kind]}`}
                      className={`absolute rounded border-2 ${KIND_COLORS[mark.kind]}`}
                      style={{
                        left: `${mark.x * 100}%`,
                        top: `${mark.y * 100}%`,
                        width: `${mark.w * 100}%`,
                        height: `${mark.h * 100}%`,
                      }}
                    >
                      <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {markIndex + 1}
                      </span>
                    </button>
                  ))}
                  {pending?.pageIndex === index && !draft && (
                    <div
                      className="pointer-events-none absolute rounded border-2 border-dashed border-primary bg-primary/10"
                      style={{
                        left: `${pending.rect.x * 100}%`,
                        top: `${pending.rect.y * 100}%`,
                        width: `${pending.rect.w * 100}%`,
                        height: `${pending.rect.h * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}

              {marks.length > 0 && (
                <ul className="space-y-2">
                  {marks.map((mark, markIndex) => (
                    <li key={mark.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">
                          {markIndex + 1}. {ANNOTATION_KIND_LABELS[mark.kind]}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDraft({
                                id: mark.id,
                                pagePath: mark.pagePath,
                                pageIndex: mark.pageIndex,
                                kind: mark.kind,
                                x: mark.x,
                                y: mark.y,
                                w: mark.w,
                                h: mark.h,
                                correction: mark.correction,
                                comment: mark.comment,
                              })
                            }
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Eliminar marca"
                            onClick={() => deleteMutation.mutate(mark.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {mark.correction && (
                        <p className="mt-1 text-muted-foreground">
                          <span className="font-medium text-foreground">Texto correcto: </span>
                          {mark.correction}
                        </p>
                      )}
                      {mark.comment && <p className="mt-1 text-muted-foreground">{mark.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {draft && (
          <div className="space-y-3 rounded-md border border-primary/40 bg-muted/40 p-4">
            <p className="text-sm font-semibold">
              {draft.id ? "Editar marca" : "Nueva marca"} · página {draft.pageIndex + 1}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="annotation-kind">Tipo</Label>
                <Select
                  value={draft.kind}
                  onValueChange={(value) => setDraft({ ...draft, kind: value as AnnotationKind })}
                >
                  <SelectTrigger id="annotation-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANNOTATION_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {ANNOTATION_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="annotation-correction">Transcripción correcta (opcional)</Label>
                <Input
                  id="annotation-correction"
                  value={draft.correction}
                  onChange={(e) => setDraft({ ...draft, correction: e.target.value })}
                  placeholder="Lo que realmente dice el texto marcado"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="annotation-comment">Comentario</Label>
              <Textarea
                id="annotation-comment"
                value={draft.comment}
                onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
                placeholder="Ej.: trazo irregular al final de la línea, tachón sobre la respuesta"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => saveMutation.mutate(draft)}
                disabled={saveMutation.isPending || (!draft.correction.trim() && !draft.comment.trim())}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar marca
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(null);
                  setPending(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
