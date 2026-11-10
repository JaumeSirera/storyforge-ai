import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Mic, MicOff, Minus, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlphaVideoCanvas } from "@/components/assistant/AlphaVideoCanvas";
import { type HelpTopic, localAnswerFor, screenName, topicsForPath } from "@/lib/assistant-help";
import { askAssistant } from "@/lib/assistant.functions";
import { readPreferredAiModel } from "@/lib/preferred-model";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "assistant"; text: string; link?: HelpTopic["link"] };
type AvatarState = "idle" | "talking" | "greeting";
type Saved = { right: number; bottom: number; collapsed: boolean; voiceOn: boolean; greeted: boolean };

const STORAGE_KEY = "xandralyze.assistant.v1";
const GREETING =
  "Hola, soy tu asistente. Pregúntame lo que necesites sobre la aplicación y te lo explico paso a paso. Si te molesto, arrástrame a otro sitio o minimízame.";
const FIG_RATIO = 382 / 480;
const PANEL_W = 360;
const BUBBLE = 60;

function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const spain = es.filter((v) => v.lang.toLowerCase() === "es-es");
  const female = /m[oó]nica|helena|laura|elvira|luc[ií]a|paulina|marisol|female|mujer|google español$/i;
  return spain.find((v) => female.test(v.name)) ?? spain[0] ?? es.find((v) => female.test(v.name)) ?? es[0] ?? null;
}

function readSaved(): Saved {
  // En el móvil empieza por encima de la barra de navegación inferior.
  const bottom = window.innerWidth < 640 ? 76 : 16;
  const base: Saved = { right: 16, bottom, collapsed: false, voiceOn: true, greeted: false };
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return raw && typeof raw === "object" ? { ...base, ...raw } : base;
  } catch {
    return base;
  }
}

function useViewport() {
  const [vp, setVp] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/**
 * Asistente personal de la app: la mujer de los vídeos, sin fondo, flotando
 * sobre la pantalla. Se arrastra a cualquier sitio (lo recuerda), se minimiza a
 * una burbuja y abre un chat con ayuda de la app, voz y micrófono. Las
 * preguntas libres las responde la IA del propio usuario.
 */
export function AssistantAvatarWidget() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const vp = useViewport();
  const mobile = vp.w < 640;
  const figW = mobile ? 112 : 150;
  const figH = Math.round(figW * FIG_RATIO);

  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState({ right: 16, bottom: 16 });
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [greeted, setGreeted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, from: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [avatar, setAvatar] = useState<AvatarState>("idle");
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [dragging, setDragging] = useState(false);

  const idleRef = useRef<HTMLVideoElement>(null);
  const talkRef = useRef<HTMLVideoElement>(null);
  const greetRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<AvatarState>("idle");
  avatarRef.current = avatar;
  const recRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null);
  const ask = useServerFn(askAssistant);

  // Restaurar posición y preferencias guardadas.
  useEffect(() => {
    const s = readSaved();
    setPos({ right: s.right, bottom: s.bottom });
    setCollapsed(s.collapsed);
    setVoiceOn(s.voiceOn);
    setGreeted(s.greeted);
    const w = window as any;
    setMicSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    window.speechSynthesis?.getVoices();
    setReady(true);
    return () => {
      recRef.current?.stop?.();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...pos, collapsed, voiceOn, greeted }));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [ready, pos, collapsed, voiceOn, greeted]);

  const boxW = collapsed ? BUBBLE : figW;
  const boxH = collapsed ? BUBBLE : figH;
  const clamp = useCallback(
    (p: { right: number; bottom: number }) => ({
      right: Math.round(Math.min(Math.max(4, p.right), Math.max(4, vp.w - boxW - 4))),
      bottom: Math.round(Math.min(Math.max(4, p.bottom), Math.max(4, vp.h - boxH - 4))),
    }),
    [vp.w, vp.h, boxW, boxH],
  );
  const shown = clamp(pos);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, open]);

  useEffect(() => {
    const v = talkRef.current;
    if (!v) return;
    if (avatar === "talking") v.play().catch(() => {});
    else v.pause();
  }, [avatar]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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

  const pushAssistant = (text: string, link?: HelpTopic["link"]) => {
    setMessages((m) => [...m, { id: nextId.current++, from: "assistant", text, link }]);
    speak(text);
  };

  const answerTopic = (topic: HelpTopic) => {
    stopSpeaking();
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text: topic.question }]);
    pushAssistant(topic.answer, topic.link);
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    stopSpeaking();
    const history = messages.slice(1).slice(-6).map(({ from, text: t }) => ({ from, text: t }));
    setMessages((m) => [...m, { id: nextId.current++, from: "user", text }]);
    setInput("");
    const topic = localAnswerFor(text);
    if (topic) {
      pushAssistant(topic.answer, topic.link);
      return;
    }
    setThinking(true);
    try {
      const res = await ask({
        data: { question: text, screen: screenName(pathname), history, model: readPreferredAiModel() ?? undefined },
      });
      if (res.ok) pushAssistant(res.answer);
      else
        pushAssistant(
          res.message,
          res.reason === "no-keys" ? { to: "/app/settings", label: "Ir a Ajustes" } : { to: "/app/ai-test", label: "Abrir Probar IA" },
        );
    } catch {
      pushAssistant("No he podido conectar ahora mismo. Revisa tu conexión y vuelve a intentarlo.");
    } finally {
      setThinking(false);
    }
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
      if (finalText.trim()) void sendText(finalText);
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

  const minimize = () => {
    stopSpeaking();
    setOpen(false);
    setCollapsed(true);
  };

  // --- Arrastrar ---------------------------------------------------------
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ...shown, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    setPos(clamp({ right: d.right - dx, bottom: d.bottom - dy }));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.moved) {
      if (collapsed) {
        setCollapsed(false);
        setOpen(true);
      } else setOpen((o) => !o);
    }
  };
  const onKeyMove = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 60 : 20;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setPos(clamp({ right: shown.right + m[0], bottom: shown.bottom + m[1] }));
  };

  if (!ready) return null;

  const activeVideo = () => {
    const a = avatarRef.current;
    if (a === "greeting") return greetRef.current;
    if (a === "talking") return talkRef.current;
    return idleRef.current;
  };

  const status = listening ? "Te escucho…" : thinking ? "Pensando…" : avatar !== "idle" ? "Hablando" : "Disponible";
  const topics = topicsForPath(pathname);
  const dragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (collapsed) {
          setCollapsed(false);
          setOpen(true);
        } else setOpen((o) => !o);
      } else onKeyMove(e);
    },
  };

  const figure = (w: number) => (
    <AlphaVideoCanvas
      getVideo={activeVideo}
      fallbackSrc="/assistant/figura.png"
      className="pointer-events-none block h-full w-full select-none drop-shadow-[0_10px_18px_rgba(15,23,42,0.28)]"
      width={480}
      height={382}
      key={w}
    />
  );

  // Panel: al lado de la figura en ordenador, como hoja inferior en el móvil.
  const figLeft = vp.w - shown.right - figW;
  const panelOnLeft = figLeft >= PANEL_W + 12;
  const panelBottom = Math.min(shown.bottom, Math.max(8, vp.h - 8 - 520));
  const panelStyle: React.CSSProperties = mobile
    ? {}
    : {
        bottom: panelBottom,
        maxHeight: vp.h - panelBottom - 8,
        width: PANEL_W,
        ...(panelOnLeft
          ? { right: shown.right + figW + 8 }
          : { right: Math.max(8, shown.right - PANEL_W - 8) }),
      };

  return (
    <>
      {/* Vídeos fuente (ocultos): el lienzo pinta el que toque sin fondo. */}
      {!collapsed && (
        <div aria-hidden className="pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0">
          <video ref={idleRef} src="/assistant/escuchando-alfa.mp4" autoPlay loop muted playsInline preload="auto" />
          <video ref={talkRef} src="/assistant/hablando-alfa.mp4" loop muted playsInline preload="auto" />
          <video ref={greetRef} src="/assistant/saludo-alfa.mp4" playsInline preload="auto" onEnded={() => setAvatar("idle")} />
        </div>
      )}

      {collapsed ? (
        <button
          type="button"
          {...dragProps}
          aria-label="Abrir asistente (arrastra para moverlo)"
          title="Pulsa para abrir · arrastra para mover"
          style={{ right: shown.right, bottom: shown.bottom, width: BUBBLE, height: BUBBLE }}
          className={cn(
            "fixed z-50 touch-none overflow-hidden rounded-full border-2 border-primary shadow-lg ring-4 ring-primary/20 transition-transform",
            dragging ? "cursor-grabbing scale-105" : "cursor-grab hover:scale-105",
          )}
        >
          <img src="/assistant/poster.jpg" alt="" draggable={false} className="pointer-events-none h-full w-full scale-150 object-cover object-[50%_35%]" />
          <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-card bg-success" />
        </button>
      ) : (
        !(mobile && open) && (
          <div
            className="group fixed z-50"
            style={{ right: shown.right, bottom: shown.bottom, width: figW, height: figH }}
          >
            <div
              role="button"
              tabIndex={0}
              {...dragProps}
              aria-label={open ? "Cerrar chat del asistente (arrastra para moverla)" : "Abrir asistente (arrastra para moverla)"}
              aria-expanded={open}
              title="Pulsa para hablar conmigo · arrastra para moverme"
              className={cn(
                "h-full w-full touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
                dragging ? "cursor-grabbing" : "cursor-grab",
              )}
            >
              {figure(figW)}
            </div>
            {!open && !dragging && (
              <span className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                ¿Te ayudo?
              </span>
            )}
            <button
              type="button"
              onClick={minimize}
              aria-label="Minimizar asistente"
              title="Minimizar"
              className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-full border bg-card text-foreground opacity-0 shadow transition-opacity hover:bg-accent focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        )
      )}

      {open && !collapsed && (
        <section
          aria-label="Asistente de Xandralyze"
          style={panelStyle}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border bg-card text-card-foreground shadow-2xl",
            mobile ? "inset-x-0 bottom-0 max-h-[78dvh] rounded-t-2xl" : "rounded-2xl",
          )}
        >
          <header className="flex shrink-0 items-center gap-2 border-b bg-muted/50 px-3 py-2">
            {mobile && (
              <div className="-my-2 -ml-1 shrink-0" style={{ width: 84, height: Math.round(84 * FIG_RATIO) }}>
                {figure(84)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Tu asistente</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full bg-success", (avatar !== "idle" || listening || thinking) && "animate-pulse")} />
                {status} · {screenName(pathname)}
              </div>
            </div>
            <button type="button" onClick={toggleVoice} aria-label={voiceOn ? "Silenciar voz" : "Activar voz"} title={voiceOn ? "Silenciar voz" : "Activar voz"} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button type="button" onClick={minimize} aria-label="Minimizar asistente" title="Minimizar" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => { stopSpeaking(); setOpen(false); }} aria-label="Cerrar chat" title="Cerrar chat" className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={listRef} className="flex min-h-[140px] flex-1 flex-col gap-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.from === "user" ? "self-end rounded-br-sm bg-primary text-primary-foreground" : "self-start rounded-bl-sm bg-muted text-foreground",
                )}
              >
                {m.text}
                {m.link && (
                  <Link
                    to={m.link.to}
                    onClick={() => mobile && setOpen(false)}
                    className="mt-2 flex w-fit items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {m.link.label} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
                {m.id === 0 && !greeted && (
                  <button
                    type="button"
                    onClick={playGreeting}
                    className="mt-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:bg-accent"
                  >
                    <Play className="h-3 w-3" /> Escuchar saludo
                  </button>
                )}
              </div>
            ))}
            {thinking && <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">Pensando…</div>}
          </div>

          <div className="shrink-0 border-t px-3 pt-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Te puedo explicar</div>
            <div className="flex max-h-[76px] flex-wrap gap-1.5 overflow-y-auto pb-2">
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => answerTopic(t)}
                  className="rounded-full border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-accent"
                >
                  {t.question}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendText(input);
            }}
            className="flex shrink-0 items-center gap-2 border-t p-3"
          >
            {micSupported && (
              <Button type="button" size="icon" variant={listening ? "destructive" : "outline"} onClick={toggleMic} aria-label={listening ? "Parar micrófono" : "Hablar"} aria-pressed={listening}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Te escucho…" : "Pregunta lo que quieras"}
              aria-label="Tu pregunta"
              className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || thinking} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
