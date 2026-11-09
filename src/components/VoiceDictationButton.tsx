import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";

/**
 * Dictado por voz con el reconocimiento del propio navegador (sin coste ni claves).
 * Va añadiendo el texto reconocido mediante `onText`.
 */
export function VoiceDictationButton({
  onText,
  disabled,
  className,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const w = window as any;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recRef.current?.stop?.();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as any;
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    const rec = new Rec();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onText(String(e.results[i][0].transcript ?? "").trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <Button
      type="button"
      variant={listening ? "destructive" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={disabled}
      className={className}
      aria-pressed={listening}
    >
      {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {listening ? "Parar dictado" : "Responder por voz"}
    </Button>
  );
}
