import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, RotateCcw, Square } from "lucide-react";

/**
 * Respuesta oral de un examen: el aspirante habla y el reconocimiento de voz del propio
 * navegador lo convierte en texto (sin claves ni coste). La transcripción no se puede
 * teclear: así la respuesta es realmente oral. Si el navegador no permite reconocer la
 * voz, se ofrece escribir la respuesta y la entrega lo indica.
 */
export function OralAnswerRecorder({
  questionNumber,
  text,
  disabled,
  onSpoken,
  onTyped,
}: {
  questionNumber: number;
  text: string;
  disabled?: boolean;
  /** Nuevo texto completo reconocido por voz. */
  onSpoken: (text: string) => void;
  /** Texto escrito cuando el navegador no permite hablar. */
  onTyped: (text: string) => void;
}) {
  const recRef = useRef<any>(null);
  const wantRef = useRef(false);
  const baseRef = useRef(text);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const w = window as any;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      wantRef.current = false;
      recRef.current?.stop?.();
    };
  }, []);

  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);

  useEffect(() => {
    if (disabled && wantRef.current) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const begin = () => {
    const w = window as any;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = String(e.results[i][0]?.transcript ?? "").trim();
        if (!piece) continue;
        if (e.results[i].isFinal) {
          baseRef.current = `${baseRef.current} ${piece}`.trim();
          onSpoken(baseRef.current);
        } else {
          partial = `${partial} ${piece}`.trim();
        }
      }
      setInterim(partial);
    };
    rec.onerror = (e: any) => {
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        wantRef.current = false;
        setError("No hay permiso para usar el micrófono. Permítelo en el navegador y vuelve a pulsar «Responder hablando».");
      } else if (e?.error === "audio-capture") {
        wantRef.current = false;
        setError("No se detecta ningún micrófono. Conecta uno y vuelve a intentarlo.");
      }
    };
    // Algunos navegadores cortan tras un silencio: si el aspirante no ha terminado, se reanuda.
    rec.onend = () => {
      setInterim("");
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* se cierra abajo */
        }
      }
      wantRef.current = false;
      setListening(false);
    };
    recRef.current = rec;
    rec.start();
  };

  const start = () => {
    setError(null);
    baseRef.current = text;
    wantRef.current = true;
    setListening(true);
    try {
      begin();
    } catch {
      wantRef.current = false;
      setListening(false);
      setError("No se ha podido activar el micrófono. Vuelve a intentarlo.");
    }
  };

  function stop() {
    wantRef.current = false;
    recRef.current?.stop?.();
  }

  const restart = () => {
    stop();
    baseRef.current = "";
    setInterim("");
    setSeconds(0);
    onSpoken("");
  };

  if (supported === null) return null;

  if (!supported) {
    return (
      <div className="space-y-2">
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Esta pregunta se responde hablando, pero tu navegador no permite convertir la voz en texto.
          Ábrela en Chrome, Edge o Safari para responder de viva voz o, si no puedes, escribe tu respuesta:
          el corrector verá que la escribiste.
        </p>
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => onTyped(e.target.value)}
          placeholder="Escribe tu respuesta"
          disabled={disabled}
          aria-label={`Respuesta escrita a la pregunta oral ${questionNumber}`}
        />
      </div>
    );
  }

  const shown = [text, interim].filter(Boolean).join(" ");
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {listening ? (
          <Button type="button" variant="destructive" onClick={stop} disabled={disabled} aria-pressed="true">
            <Square className="h-4 w-4" aria-hidden="true" /> Terminar respuesta
          </Button>
        ) : (
          <Button type="button" onClick={start} disabled={disabled}>
            <Mic className="h-4 w-4" aria-hidden="true" /> {text ? "Seguir hablando" : "Responder hablando"}
          </Button>
        )}
        {text && !listening && (
          <Button type="button" variant="ghost" onClick={restart} disabled={disabled}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Borrar y empezar de nuevo
          </Button>
        )}
        {listening && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            Escuchando · {mm}:{ss}
          </span>
        )}
      </div>
      <div
        aria-label={`Transcripción de tu respuesta oral a la pregunta ${questionNumber}`}
        aria-live="polite"
        className="min-h-24 whitespace-pre-line rounded-md border border-border bg-muted/30 p-3 text-sm leading-relaxed"
      >
        {shown || (
          <span className="text-muted-foreground">
            Pulsa «Responder hablando» y contesta en voz alta. Aquí verás lo que se va entendiendo.
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Se guarda el texto de lo que dices, no el audio. Las faltas del dictado no cuentan en la nota.
      </p>
    </div>
  );
}
