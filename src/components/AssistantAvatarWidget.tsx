import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Play, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";
import { HELP_TOPICS, findHelpTopic } from "@/lib/assistant-help";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "assistant"; text: string };
type AvatarState = "idle" | "talking" | "greeting";

const GREETING = "Hola, soy tu asistente. Pregúntame lo que necesites sobre la aplicación y te lo explico paso a paso.";
const FREE_PROMPT_SAMPLE =
  "Esta pregunta no es sobre el manejo de la app. En la versión final te respondería con tu propia IA, la que tienes configurada en «Ajustes». En esta muestra, prueba con preguntas sobre cómo usar Xandralyze.";

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const spain = es.filter((v) => v.lang.toLowerCase() === "es-es");
  const female = /m[oó]nica|helena|laura|elvira|luc[ií]a|paulina|marisol|female|mujer|google español$/i;
  return spain.find((v) => female.test(v.name)) ?? spain[0] ?? es.find((v) => female.test(v.name)) ?? es[0] ?? null;
}

/**
 * Asistente con avatar animado (muestra). El avatar alterna dos vídeos en bucle:
 * escuchando (boca cerrada) y hablando (mientras suena la voz del navegador).
 */
export function AssistantAvatarWidget({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, from: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [avatar, setAvatar] = useState<AvatarState>("idle");
  const [greeted, setGreeted] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  const greetRef = useRef<HTMLVideoElement>(null);
  const talkRef = useRef<HTMLVideoElement>(null);
  const recRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const w = window as any;
    setMicSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    window.speechSynthesis?.getVoices();
    return () => {
      recRef.current?.stop?.();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    const v = talkRef.current;
    if (!v) return;
    if (avatar === "talking") v.play().catch(() => {});
    else v.pause();
  }, [avatar]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    const g = greetRef.current;
    if (g && !g.paused) g.pause();
    setAvatar("idle");
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickSpanishVoice();
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "es-ES";
      u.rate = 1.05;
      u.onstart = () => setAvatar("talking");
      u.onend = () => setAvatar("idle");
      u.onerror = () => setAvatar("idle");
      window.speechSynthesis.speak(u);
    },
    [voiceOn],
  );

  const playGreeting = () => {
    const g = greetRef.current;
    if (!g) return;
    window.speechSynthesis?.cancel();
    g.currentTime = 0;
    g.muted = !voiceOn;
    setAvatar("greeting");
    setGreeted(true);
    g.play().catch(() => setAvatar("idle"));
  };

  const ask = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    stopSpeaking();
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      const topic = findHelpTopic(text);
      const answer = topic ? topic.answer : FREE_PROMPT_SAMPLE;
      setMessages((m) => [...m, { id: nextId.current++, from: "assistant", text: answer }]);
      setThinking(false);
      speak(answer);
    }, 700);
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    stopSpeaking();
    const w = window as any;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = "es-ES";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = String(e.results[i][0].transcript ?? "");
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).trim());
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) ask(finalText);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const toggleVoice = () => {
    if (voiceOn) stopSpeaking();
    setVoiceOn((v) => !v);
  };

  const status = listening ? "Te escucho…" : thinking ? "Pensando…" : avatar !== "idle" ? "Hablando" : "Disponible";
  const suggestions = HELP_TOPICS.slice(0, 5);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          className="fixed bottom-5 right-5 z-50 h-16 w-16 overflow-hidden rounded-full border-2 border-primary shadow-lg ring-4 ring-primary/20 transition-transform hover:scale-105"
        >
          <img src="/assistant/poster.jpg" alt="" className="h-full w-full scale-150 object-cover object-[50%_35%]" />
          <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-card bg-success" />
        </button>
      )}

      {open && (
        <section
          aria-label="Asistente de Xandralyze"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border bg-card text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[400px] sm:rounded-2xl"
        >
          <div className="relative aspect-video w-full shrink-0 bg-muted">
            <video
              src="/assistant/escuchando.mp4"
              poster="/assistant/poster.jpg"
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            <video
              ref={talkRef}
              src="/assistant/hablando.mp4"
              loop
              muted
              playsInline
              preload="auto"
              className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-200", avatar === "talking" ? "opacity-100" : "opacity-0")}
            />
            <video
              ref={greetRef}
              src="/assistant/saludo.mp4"
              playsInline
              preload="auto"
              onEnded={() => setAvatar("idle")}
              className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-200", avatar === "greeting" ? "opacity-100" : "opacity-0")}
            />

            <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-foreground/50 to-transparent p-3 text-background">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className={cn("h-2.5 w-2.5 rounded-full", avatar !== "idle" || listening ? "animate-pulse bg-success" : "bg-success")} />
                Asistente · {status}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={toggleVoice} aria-label={voiceOn ? "Silenciar voz" : "Activar voz"} className="rounded-full p-1.5 hover:bg-background/20">
                  {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => { stopSpeaking(); setOpen(false); }} aria-label="Cerrar asistente" className="rounded-full p-1.5 hover:bg-background/20">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!greeted && (
              <button
                type="button"
                onClick={playGreeting}
                className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
              >
                <Play className="h-4 w-4" /> Escuchar saludo
              </button>
            )}
          </div>

          <div ref={listRef} className="flex min-h-[160px] flex-1 flex-col gap-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.from === "user" ? "self-end rounded-br-sm bg-primary text-primary-foreground" : "self-start rounded-bl-sm bg-muted text-foreground",
                )}
              >
                {m.text}
              </div>
            ))}
            {thinking && (
              <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">Escribiendo…</div>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => ask(s.question)}
                className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs text-foreground hover:bg-accent"
              >
                {s.question}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-center gap-2 border-t p-3"
          >
            {micSupported && (
              <Button type="button" size="icon" variant={listening ? "destructive" : "outline"} onClick={toggleMic} aria-label={listening ? "Parar micrófono" : "Hablar"} aria-pressed={listening}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Te escucho…" : "Escribe o pulsa el micrófono"}
              aria-label="Tu pregunta"
              className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || thinking} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="flex items-center gap-1 px-3 pb-3 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Muestra: las respuestas sobre la app son de ejemplo; la voz es la de tu navegador.
          </p>
        </section>
      )}
    </>
  );
}
