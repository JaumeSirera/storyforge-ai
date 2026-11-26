import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createSubmission, getAssessment, getSubmission, gradeSubmission } from "@/lib/assessments.functions";
import { formatExamAnswers, type ExamAnswerInput } from "@/lib/assessment-candidates-shared";
import { gradeLabel, type SubmissionRecord } from "@/lib/assessments-shared";
import { OralAnswerRecorder } from "@/components/OralAnswerRecorder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, Mic } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/assessments/$id/oral")({
  head: () => ({
    meta: [
      { title: "Prueba oral en directo | Xandralyze" },
      { name: "description", content: "Haz la parte oral con micrófono, pregunta a pregunta, y obtén la puntuación al terminar." },
      { property: "og:title", content: "Prueba oral en directo | Xandralyze" },
      { property: "og:description", content: "Micrófono, transcripción y nota automática de la prueba oral." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OralSession,
});

type Answer = { text: string; spoken: boolean };

function OralSession() {
  const { id } = Route.useParams();
  const get = useServerFn(getAssessment);
  const create = useServerFn(createSubmission);
  const grade = useServerFn(gradeSubmission);
  const fetchSub = useServerFn(getSubmission);
  const q = useQuery({ queryKey: ["assessment", id], queryFn: () => get({ data: { id } }) });
  const assessment = q.data?.assessment;
  const questions = useMemo(
    () => (assessment?.questions ?? []).filter((x) => x.type === "oral"),
    [assessment],
  );

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmissionRecord | null>(null);

  if (q.isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" aria-label="Cargando" /></div>;
  }
  if (!assessment) return <p className="p-8">No se encontró la evaluación.</p>;

  const back = (
    <Link to="/app/assessments/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a la evaluación
    </Link>
  );

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {back}
        <Card><CardContent className="p-6">Esta evaluación no tiene preguntas orales. Cambia el tipo de alguna pregunta a «Oral» en la rúbrica.</CardContent></Card>
      </div>
    );
  }

  const current = questions[index];
  const answered = questions.filter((x) => answers[x.id]?.text.trim()).length;
  const setAnswer = (qid: string, a: Answer) => setAnswers((p) => ({ ...p, [qid]: a }));

  const finish = async () => {
    if (answered === 0) return toast.error("Responde al menos una pregunta antes de puntuar.");
    setBusy(true);
    try {
      const list: ExamAnswerInput[] = questions.map((x) => ({
        questionId: x.id,
        optionIds: [],
        text: answers[x.id]?.text ?? "",
        spoken: answers[x.id]?.spoken ?? false,
      }));
      const fd = new FormData();
      fd.set("assessmentId", id);
      fd.set("candidateName", name.trim());
      if (identifier.trim()) fd.set("candidateIdentifier", identifier.trim());
      fd.set("sourceKind", "digital");
      fd.set("typedText", formatExamAnswers(questions.map((x) => ({ id: x.id, prompt: x.prompt, type: x.type, maxPoints: x.maxPoints, options: [] })), list));
      const { submission } = await create({ data: fd });
      await grade({ data: { id: submission.id } });
      const res = (await fetchSub({ data: { id: submission.id } })) as { submission: SubmissionRecord };
      setResult(res.submission);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo puntuar la prueba.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const ev = result.evaluation;
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        {back}
        <Card>
          <CardHeader>
            <CardTitle>Puntuación de {result.candidateName}</CardTitle>
            <CardDescription>{assessment.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.score !== null && result.maxScore ? (
              <p className="text-4xl font-semibold">
                {result.score} / {result.maxScore}{" "}
                <span className="text-lg text-muted-foreground">· {gradeLabel(result.score, result.maxScore)}</span>
              </p>
            ) : (
              <p>{result.errorMessage ?? "La puntuación todavía no está lista."}</p>
            )}
            {ev?.summary && <p className="text-muted-foreground">{ev.summary}</p>}
            <ul className="space-y-3">
              {(ev?.answers ?? []).map((a, i) => (
                <li key={a.questionId || i} className="rounded-md border p-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{i + 1}. {a.question}</span>
                    <Badge variant="outline">{a.score} / {a.maxPoints}</Badge>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/app/assessments/$id/submissions/$sid" params={{ id, sid: result.id }}>Ver informe completo</Link>
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setStarted(false); setAnswers({}); setIndex(0); setName(""); setIdentifier(""); }}>
                Siguiente aspirante
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {back}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mic className="h-5 w-5" aria-hidden="true" /> Prueba oral</CardTitle>
            <CardDescription>
              {assessment.title} · {questions.length} pregunta(s) oral(es). Haz la prueba aquí con el aspirante delante: lee cada pregunta, pulsa el micrófono y deja que responda. Al terminar se puntúa sola.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oral-name">Nombre del aspirante</Label>
              <Input id="oral-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellidos" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oral-id">Identificador (opcional)</Label>
              <Input id="oral-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="DNI, nº de lista, correo…" />
            </div>
            <p className="text-sm text-muted-foreground">
              Se guarda solo el texto de lo que dice, no el audio. El reconocimiento de voz lo hace el propio navegador (mejor en Chrome, Edge o Safari).
            </p>
            <Button disabled={!name.trim()} onClick={() => setStarted(true)}>Empezar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      {back}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{name}</span>
        <span>Pregunta {index + 1} de {questions.length} · {answered} respondida(s)</span>
      </div>
      {current && (
        <Card key={current.id}>
          <CardHeader>
            <CardTitle className="text-xl leading-snug">{current.prompt}</CardTitle>
            <CardDescription>{current.maxPoints} punto(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <OralAnswerRecorder
              questionNumber={index + 1}
              text={answers[current.id]?.text ?? ""}
              disabled={busy}
              onSpoken={(text) => setAnswer(current.id, { text, spoken: true })}
              onTyped={(text) => setAnswer(current.id, { text, spoken: false })}
            />
          </CardContent>
        </Card>
      )}
      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={index === 0 || busy} onClick={() => setIndex((i) => i - 1)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Anterior
        </Button>
        {index < questions.length - 1 ? (
          <Button disabled={busy} onClick={() => setIndex((i) => i + 1)}>
            Siguiente <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button disabled={busy} onClick={finish}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Puntuando…</> : "Terminar y puntuar"}
          </Button>
        )}
      </div>
    </div>
  );
}
