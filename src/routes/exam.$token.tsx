import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getExam, startExam, submitExam } from "@/lib/assessment-candidates.functions";
import type { ExamPayload } from "@/lib/assessment-candidates-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlarmClock, CheckCircle2, Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/exam/$token")({
  head: () => ({
    meta: [
      { title: "Realizar el examen · Playnalyze" },
      {
        name: "description",
        content:
          "Accede con tu enlace privado para realizar la prueba escrita asignada y enviar tus respuestas.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Realizar el examen · Playnalyze" },
      { property: "og:description", content: "Prueba escrita por invitación privada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamPage,
});

interface AnswerState {
  text: string;
  optionIds: string[];
}

function ExamPage() {
  const { token } = Route.useParams();
  const load = useServerFn(getExam);
  const start = useServerFn(startExam);
  const send = useServerFn(submitExam);

  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [done, setDone] = useState(false);
  /** ISO de la entrega, devuelto por el servidor al finalizar el examen. */
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  /** Marca temporal local equivalente al fin del examen (calculada con la hora del servidor). */
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);

  const q = useQuery({
    queryKey: ["exam", token],
    queryFn: () => load({ data: { token } }) as Promise<ExamPayload>,
    retry: false,
  });
  const exam = q.data;

  useEffect(() => {
    if (!exam || exam.candidate.status === "submitted") return;
    start({ data: { token } })
      .then((res: any) => {
        const limit = exam.assessment.timeLimitMin;
        if (!limit || limit <= 0) return;
        const startedAt = new Date(res?.startedAt ?? exam.candidate.startedAt ?? exam.serverNow).getTime();
        const serverNow = new Date(res?.serverNow ?? exam.serverNow).getTime();
        // Compensamos el desfase entre el reloj del servidor y el del navegador.
        const skew = Date.now() - serverNow;
        setDeadline(startedAt + limit * 60_000 + skew);
      })
      .catch(() => {});
  }, [exam, start, token]);

  // Cuenta atrás visible + entrega automática al agotarse el tiempo.
  useEffect(() => {
    if (deadline == null) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSec(left);
      if (left === 0) setExpired(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  const answered = useMemo(
    () =>
      Object.values(answers).filter((a) => a.text.trim() || a.optionIds.length > 0).length,
    [answers],
  );

  const setAnswer = (id: string, patch: Partial<AnswerState>) =>
    setAnswers((prev) => ({
      ...prev,
      [id]: { text: prev[id]?.text ?? "", optionIds: prev[id]?.optionIds ?? [], ...patch },
    }));

  const submitMut = useMutation<unknown, Error, boolean>({
    mutationFn: (auto: boolean) =>
      send({
        data: {
          token,
          auto,
          answers: (exam?.assessment.questions ?? []).map((qq) => ({
            questionId: qq.id,
            text: answers[qq.id]?.text ?? "",
            optionIds: answers[qq.id]?.optionIds ?? [],
          })),
        },
      }),
    onSuccess: (res: any) => {
      setSubmittedAt(res?.submittedAt ?? new Date().toISOString());
      setDone(true);
      toast.success("Examen finalizado y entregado correctamente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!expired || autoSentRef.current || done) return;
    autoSentRef.current = true;
    toast.info("Se ha agotado el tiempo: entregando tus respuestas…");
    submitMut.mutate(true);
  }, [expired, done, submitMut]);

  const timeLabel =
    remainingSec == null
      ? null
      : `${String(Math.floor(remainingSec / 60)).padStart(2, "0")}:${String(remainingSec % 60).padStart(2, "0")}`;

  if (q.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </main>
    );
  }

  if (q.isError || !exam) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle>No se puede abrir el examen</CardTitle>
            <CardDescription>
              {(q.error as Error | null)?.message ??
                "El enlace no es válido o ya no está disponible. Contacta con la persona que te convocó."}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (done || exam.candidate.status === "submitted") {
    const sentAt = submittedAt ?? exam.candidate.submittedAt;
    const sentLabel = sentAt
      ? new Date(sentAt).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })
      : null;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
              Examen finalizado
            </CardTitle>
            <CardDescription>
              Gracias, {exam.candidate.name}. Tus respuestas se han registrado y ya no pueden
              modificarse. El equipo evaluador las corregirá. Ya puedes cerrar esta ventana.
            </CardDescription>
          </CardHeader>
          {sentLabel && (
            <CardContent className="space-y-1">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" aria-hidden="true" />
                Entrega registrada el {sentLabel}
              </p>
              {exam.candidate.timeExpired && (
                <p className="text-xs text-muted-foreground">
                  Entrega realizada al agotarse el tiempo disponible.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      </main>
    );
  }

  /** Mientras se envía o tras finalizar, las respuestas quedan bloqueadas. */
  const locked = submitMut.isPending || done;

  const { assessment } = exam;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Prueba escrita</Badge>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{assessment.title}</h1>
          {timeLabel && (
            <div
              role="timer"
              aria-live="off"
              aria-label={`Tiempo restante ${timeLabel}`}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
                (remainingSec ?? 0) <= 60
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border bg-muted text-foreground"
              }`}
            >
              <AlarmClock className="h-4 w-4" aria-hidden="true" />
              {timeLabel}
            </div>
          )}
        </div>
        {assessment.timeLimitMin ? (
          <p className="text-xs text-muted-foreground">
            Tiempo total: {assessment.timeLimitMin} minutos. Al agotarse, el examen se entrega
            automáticamente con lo que tengas respondido.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Aspirante: {exam.candidate.name}
          {exam.candidate.identifier ? ` · ${exam.candidate.identifier}` : ""} · Puntuación máxima:{" "}
          {assessment.maxScore}
        </p>
      </header>

      <ol className="space-y-4">
        {assessment.questions.map((question, index) => {
          const state = answers[question.id] ?? { text: "", optionIds: [] };
          return (
            <li key={question.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {index + 1}. {question.prompt}
                  </CardTitle>
                  <CardDescription>{question.maxPoints} punto(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {question.type === "narrative" && (
                    <Textarea
                      rows={6}
                      value={state.text}
                      onChange={(e) => setAnswer(question.id, { text: e.target.value })}
                      placeholder="Escribe tu respuesta"
                      aria-label={`Respuesta a la pregunta ${index + 1}`}
                    />
                  )}

                  {question.type === "numeric" && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`num-${question.id}`}>Resultado</Label>
                      <Input
                        id={`num-${question.id}`}
                        value={state.text}
                        onChange={(e) => setAnswer(question.id, { text: e.target.value })}
                        placeholder="Introduce el resultado"
                      />
                    </div>
                  )}

                  {(question.type === "single_choice" || question.type === "true_false") && (
                    <RadioGroup
                      value={state.optionIds[0] ?? ""}
                      onValueChange={(value) => setAnswer(question.id, { optionIds: [value] })}
                      className="space-y-2"
                    >
                      {(question.options.length > 0
                        ? question.options
                        : [
                            { id: "true", text: "Verdadero" },
                            { id: "false", text: "Falso" },
                          ]
                      ).map((option) => (
                        <div key={option.id} className="flex items-start gap-2">
                          <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                          <Label
                            htmlFor={`${question.id}-${option.id}`}
                            className="font-normal leading-snug"
                          >
                            {option.text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {question.type === "multiple_choice" && (
                    <div className="space-y-2">
                      {question.options.map((option) => {
                        const checked = state.optionIds.includes(option.id);
                        return (
                          <div key={option.id} className="flex items-start gap-2">
                            <Checkbox
                              id={`${question.id}-${option.id}`}
                              checked={checked}
                              onCheckedChange={(value) =>
                                setAnswer(question.id, {
                                  optionIds: value
                                    ? [...state.optionIds, option.id]
                                    : state.optionIds.filter((o) => o !== option.id),
                                })
                              }
                            />
                            <Label
                              htmlFor={`${question.id}-${option.id}`}
                              className="font-normal leading-snug"
                            >
                              {option.text}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {question.type !== "narrative" && (
                    <Textarea
                      rows={3}
                      value={question.type === "numeric" ? "" : state.text}
                      onChange={(e) =>
                        question.type !== "numeric" && setAnswer(question.id, { text: e.target.value })
                      }
                      placeholder="Justificación (opcional)"
                      aria-label={`Justificación de la pregunta ${index + 1}`}
                      className={question.type === "numeric" ? "hidden" : ""}
                    />
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border/60 bg-background/95 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {answered} de {assessment.questions.length} preguntas respondidas
          {expired ? " · tiempo agotado" : timeLabel ? ` · quedan ${timeLabel}` : ""}
        </p>
        <Button onClick={() => submitMut.mutate(false)} disabled={submitMut.isPending || expired}>
          {submitMut.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Entregar examen
        </Button>
      </div>
    </main>
  );
}
