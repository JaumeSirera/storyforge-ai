import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listHypothesisReviews,
  saveHypothesisReview,
  type HypothesisReview,
  type ReviewConfidence,
  type ReviewStatus,
} from "@/lib/hypothesis-reviews.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, History, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

type Hypothesis = { hypothesis: string; basis: string; confidence: string };

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Sin revisar",
  validated: "Validada",
  adjusted: "Ajustada",
  rejected: "Descartada",
};

const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  validated: "default",
  adjusted: "secondary",
  rejected: "destructive",
};

const CONFIDENCE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  alta: "default",
  media: "secondary",
  baja: "outline",
};

/**
 * Permite al profesional validar, ajustar o descartar cada hipótesis del informe,
 * dejando un comentario y su propio nivel de confianza, con historial de cambios.
 */
export function HypothesisValidationPanel({
  captureSessionId,
  hypotheses,
}: {
  captureSessionId: string;
  hypotheses: Hypothesis[];
}) {
  const qc = useQueryClient();
  const list = useServerFn(listHypothesisReviews);
  const save = useServerFn(saveHypothesisReview);

  const reviewsQ = useQuery({
    queryKey: ["hypothesis-reviews", captureSessionId],
    queryFn: () => list({ data: { captureSessionId } }),
  });

  const reviewByIndex = useMemo(() => {
    const map = new Map<number, HypothesisReview>();
    for (const r of reviewsQ.data?.reviews ?? []) map.set(r.hypothesisIndex, r);
    return map;
  }, [reviewsQ.data]);

  const events = reviewsQ.data?.events ?? [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<{
    status: ReviewStatus;
    adjustedText: string;
    confidence: ReviewConfidence;
    comment: string;
  }>({ status: "validated", adjustedText: "", confidence: "media", comment: "" });
  const [saving, setSaving] = useState(false);

  function startEdit(i: number, h: Hypothesis) {
    const r = reviewByIndex.get(i);
    setDraft({
      status: r?.status && r.status !== "pending" ? r.status : "validated",
      adjustedText: r?.adjustedText || "",
      confidence: (r?.confidence as ReviewConfidence) || ((["alta", "media", "baja"] as string[]).includes(h.confidence) ? (h.confidence as ReviewConfidence) : "media"),
      comment: r?.comment || "",
    });
    setOpenIndex(i);
  }

  async function submit(i: number, h: Hypothesis) {
    setSaving(true);
    try {
      await save({
        data: {
          captureSessionId,
          hypothesisIndex: i,
          hypothesisText: h.hypothesis,
          status: draft.status,
          adjustedText: draft.status === "adjusted" ? draft.adjustedText : "",
          confidence: draft.confidence,
          comment: draft.comment,
        },
      });
      await qc.invalidateQueries({ queryKey: ["hypothesis-reviews", captureSessionId] });
      setOpenIndex(null);
      toast.success("Revisión guardada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar la revisión");
    } finally {
      setSaving(false);
    }
  }

  if (hypotheses.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hipótesis de trabajo</CardTitle>
        <CardDescription>
          Interpretaciones trazables. Valida, ajusta o descarta cada hipótesis con tu comentario y tu
          nivel de confianza; cada cambio queda registrado en el historial.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hypotheses.map((h, i) => {
          const review = reviewByIndex.get(i);
          const status: ReviewStatus = review?.status ?? "pending";
          const history = events.filter((e) => e.hypothesisIndex === i);
          const editing = openIndex === i;
          return (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">{h.hypothesis}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={CONFIDENCE_VARIANT[h.confidence] ?? "outline"}>
                    IA: confianza {h.confidence}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Base: {h.basis}</p>

              {review && review.status !== "pending" && (
                <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2 text-xs">
                  {review.adjustedText && (
                    <p>
                      <strong>Redacción ajustada:</strong> {review.adjustedText}
                    </p>
                  )}
                  {review.comment && (
                    <p>
                      <strong>Comentario:</strong> {review.comment}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Confianza del profesional: {review.confidence} · actualizado{" "}
                    {new Date(review.updatedAt).toLocaleString("es-ES")}
                  </p>
                </div>
              )}

              {!editing && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => startEdit(i, h)}>
                    <Pencil className="h-3.5 w-3.5" /> Revisar
                  </Button>
                  {history.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      aria-expanded={historyIndex === i}
                      onClick={() => setHistoryIndex(historyIndex === i ? null : i)}
                    >
                      <History className="h-3.5 w-3.5" /> Historial ({history.length})
                    </Button>
                  )}
                </div>
              )}

              {editing && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`status-${i}`}>Decisión</Label>
                      <Select
                        value={draft.status}
                        onValueChange={(v) => setDraft((d) => ({ ...d, status: v as ReviewStatus }))}
                      >
                        <SelectTrigger id={`status-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="validated">Validar</SelectItem>
                          <SelectItem value="adjusted">Ajustar redacción</SelectItem>
                          <SelectItem value="rejected">Descartar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`confidence-${i}`}>Tu nivel de confianza</Label>
                      <Select
                        value={draft.confidence}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, confidence: v as ReviewConfidence }))
                        }
                      >
                        <SelectTrigger id={`confidence-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="baja">Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {draft.status === "adjusted" && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`adjusted-${i}`}>Redacción ajustada de la hipótesis</Label>
                      <Textarea
                        id={`adjusted-${i}`}
                        rows={2}
                        value={draft.adjustedText}
                        onChange={(e) => setDraft((d) => ({ ...d, adjustedText: e.target.value }))}
                        placeholder="Reescribe la hipótesis como la formularías tú"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor={`comment-${i}`}>Comentario</Label>
                    <Textarea
                      id={`comment-${i}`}
                      rows={2}
                      value={draft.comment}
                      onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                      placeholder="Qué respalda o contradice esta hipótesis según tu criterio profesional"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-2" disabled={saving} onClick={() => submit(i, h)}>
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Guardar revisión
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-2"
                      disabled={saving}
                      onClick={() => setOpenIndex(null)}
                    >
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {historyIndex === i && history.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                  {history.map((ev) => (
                    <li key={ev.id} className="rounded-md bg-muted/40 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[ev.status]}>{STATUS_LABEL[ev.status]}</Badge>
                        <span className="text-muted-foreground">
                          confianza {ev.confidence} ·{" "}
                          {new Date(ev.createdAt).toLocaleString("es-ES")}
                          {ev.action === "create" ? " · primera revisión" : ""}
                        </span>
                      </div>
                      {ev.adjustedText && <p className="mt-1">Ajuste: {ev.adjustedText}</p>}
                      {ev.comment && <p className="mt-1 text-muted-foreground">{ev.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
