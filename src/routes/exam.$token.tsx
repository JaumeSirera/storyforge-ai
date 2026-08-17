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
  /** true cuando el aspirante ya ha pulsado "Comenzar examen" (o lo había comenzado antes). */
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);

  const answersKey = `playnalyze.exam.answers.${token}`;
  const submittedKey = `playnalyze.exam.submitted.${token}`;

  const q = useQuery({
    queryKey: ["exam", token],
    queryFn: () => load({ data: { token } }) as Promise<ExamPayload>,
    retry: false,
  });
  const exam = q.data;

  // Bloqueo local: si ya se entregó desde este navegador, no se permite editar aunque refresque.
  useEffect(() => {
    try {
      const flag = window.localStorage.getItem(submittedKey);
      if (flag) {
        setSubmittedAt(flag);
        setDone(true);
      }
    } catch {
      /* almacenamiento no disponible */
    }
  }, [submittedKey]);

  // Recupera las respuestas guardadas para continuar donde lo dejó tras un refresco.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(answersKey);
      if (raw) setAnswers(JSON.parse(raw) as Record<string, AnswerState>);
    } catch {
      /* datos corruptos: se ignoran */
    }
  }, [answersKey]);

  // Guarda el progreso en cada cambio.
  useEffect(() => {
    if (!restoredRef.current || done) return;
    try {
      window.localStorage.setItem(answersKey, JSON.stringify(answers));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [answers, answersKey, done]);

  /** Calcula el fin del examen a partir de la hora del servidor. */
  const applyDeadline = (startedAtIso?: string | null, serverNowIso?: string | null) => {
    const limit = exam?.assessment.timeLimitMin;
    if (!limit || limit <= 0) return;
    const startedAt = new Date(startedAtIso ?? exam?.serverNow ?? Date.now()).getTime();
    const serverNow = new Date(serverNowIso ?? exam?.serverNow ?? Date.now()).getTime();
    // Compensamos el desfase entre el reloj del servidor y el del navegador.
    const skew = Date.now() - serverNow;
    setDeadline(startedAt + limit * 60_000 + skew);
  };

  // Si ya había comenzado (p. ej. tras refrescar), se reanuda automáticamente sin reiniciar el tiempo.
  useEffect(() => {
    if (!exam || started || done) return;
    if (exam.candidate.status === "started" && exam.candidate.startedAt) {
      setStarted(true);
      applyDeadline(exam.candidate.startedAt, exam.serverNow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, started, done]);

  const beginExam = async () => {
    setStarting(true);
    try {
      const res: any = await start({ data: { token } });
      setStarted(true);
      applyDeadline(res?.startedAt ?? exam?.candidate.startedAt, res?.serverNow);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

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
      const at = res?.submittedAt ?? new Date().toISOString();
      setSubmittedAt(at);
      setDone(true);
      try {
        window.localStorage.setItem(submittedKey, at);
        window.localStorage.removeItem(answersKey);
      } catch {
        /* almacenamiento no disponible */
      }
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
                      disabled={locked}
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
                        disabled={locked}
                      />
                    </div>
                  )}

                  {(question.type === "single_choice" || question.type === "true_false") && (
                    <RadioGroup
                      value={state.optionIds[0] ?? ""}
                      onValueChange={(value) => setAnswer(question.id, { optionIds: [value] })}
                      disabled={locked}
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
                              disabled={locked}
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
                      disabled={locked}
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={locked || expired}>
              {submitMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Finalizar examen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Finalizar y entregar el examen?</AlertDialogTitle>
              <AlertDialogDescription>
                Has respondido {answered} de {assessment.questions.length} preguntas. Al finalizar se
                registrará la fecha de envío y no podrás modificar tus respuestas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir respondiendo</AlertDialogCancel>
              <AlertDialogAction onClick={() => submitMut.mutate(false)}>
                Finalizar y entregar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
}
