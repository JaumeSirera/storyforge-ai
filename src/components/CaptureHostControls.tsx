import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  joinCaptureControlChannel,
  sendCaptureControl,
  type CaptureControlAction,
} from "@/lib/capture-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle, Pause, Play, Radio, Square } from "lucide-react";
import { toast } from "sonner";

interface Props {
  captureSessionId: string;
}

/** Controles del anfitrión: sincronizan inicio/pausa/parada en todos los dispositivos del mosaico. */
export function CaptureHostControls({ captureSessionId }: Props) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "recording" | "paused">("idle");

  useEffect(() => {
    const channel = joinCaptureControlChannel(captureSessionId);
    channelRef.current = channel;
    const t = setTimeout(() => setReady(true), 300);
    return () => {
      clearTimeout(t);
      channelRef.current = null;
      void channel.unsubscribe();
    };
  }, [captureSessionId]);

  async function send(action: CaptureControlAction, label: string) {
    try {
      await sendCaptureControl(channelRef.current, action);
      setPhase(action === "start" || action === "resume" ? "recording" : action === "pause" ? "paused" : "idle");
      toast.success(label);
    } catch {
      toast.error("No se pudo enviar la orden a los participantes");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4" /> Control del anfitrión
        </CardTitle>
        <CardDescription>
          Inicia, pausa o finaliza la grabación simultáneamente en todos los dispositivos
          conectados a esta sesión. Cada participante debe tener su cámara autorizada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {phase !== "recording" ? (
          <Button
            onClick={() => send(phase === "paused" ? "resume" : "start", phase === "paused" ? "Grabación reanudada en todos los dispositivos" : "Grabación iniciada en todos los dispositivos")}
            disabled={!ready}
            className="gap-2"
          >
            {phase === "paused" ? <Play className="h-4 w-4" /> : <Circle className="h-4 w-4 fill-current" />}
            {phase === "paused" ? "Reanudar en todos" : "Iniciar en todos"}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => send("pause", "Grabación pausada en todos los dispositivos")}
            disabled={!ready}
            className="gap-2"
          >
            <Pause className="h-4 w-4" /> Pausar en todos
          </Button>
        )}
        <Button
          variant="destructive"
          onClick={() => send("stop", "Grabación finalizada; cada dispositivo sube su pista")}
          disabled={!ready || phase === "idle"}
          className="gap-2"
        >
          <Square className="h-4 w-4" /> Detener y guardar
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {phase === "recording"
            ? "Grabando en todos los dispositivos"
            : phase === "paused"
              ? "En pausa"
              : "En espera"}
        </span>
      </CardContent>
    </Card>
  );
}
