import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Loader2, Wifi } from "lucide-react";
import {
  latencyVerdict,
  mbps,
  micVerdict,
  uploadVerdict,
  VERDICT_LABEL,
  type CheckVerdict,
} from "@/lib/device-check";

const UPLOAD_BYTES = 1024 * 1024;

function VerdictBadge({ v }: { v: CheckVerdict | null }) {
  if (!v) return null;
  return <Badge variant={v === "buena" ? "default" : v === "justa" ? "secondary" : "destructive"}>{VERDICT_LABEL[v]}</Badge>;
}

/**
 * Prueba previa: vista de la cámara elegida, medidor del micrófono y prueba de
 * subida/latencia contra el propio servidor. No graba ni guarda nada.
 */
export function DeviceCheckPanel({
  videoDeviceId,
  audioDeviceId,
  videoOnly = false,
}: {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  videoOnly?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const [net, setNet] = useState<{ upload: number; latency: number } | null>(null);
  const [netError, setNetError] = useState<string | null>(null);
  const [netBusy, setNetBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  function stop() {
    cleanup.current?.();
    cleanup.current = null;
    setRunning(false);
  }

  async function testConnection() {
    setNetBusy(true);
    setNetError(null);
    try {
      const pings: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        await fetch(`/api/public/speedtest?t=${Date.now()}`, { cache: "no-store" });
        pings.push(performance.now() - t0);
      }
      const payload = new Uint8Array(UPLOAD_BYTES);
      crypto.getRandomValues(payload.subarray(0, 65536));
      const t0 = performance.now();
      const res = await fetch("/api/public/speedtest", { method: "POST", body: payload, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ms = performance.now() - t0;
      setNet({ upload: mbps(UPLOAD_BYTES, ms), latency: Math.round(Math.min(...pings)) });
    } catch {
      setNetError("No se pudo medir la conexión. Comprueba que tienes internet.");
    } finally {
      setNetBusy(false);
    }
  }

  async function start() {
    stop();
    setRunning(true);
    setPeak(0);
    setCamOk(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: videoOnly ? false : audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      });
      setCamOk(stream.getVideoTracks().some((t) => t.readyState === "live"));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => {});
      }
      let raf = 0;
      let ctx: AudioContext | null = null;
      if (!videoOnly && stream.getAudioTracks().length > 0) {
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (const x of buf) sum += x * x;
          const rms = Math.sqrt(sum / buf.length);
          setLevel(rms);
          setPeak((p) => Math.max(p, rms));
          raf = requestAnimationFrame(tick);
        };
        tick();
      }
      cleanup.current = () => {
        cancelAnimationFrame(raf);
        void ctx?.close();
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };
      void testConnection();
    } catch {
      setCamOk(false);
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" aria-hidden /> Prueba previa
        </p>
        {running ? (
          <Button size="sm" variant="outline" onClick={stop}>Terminar prueba</Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={start}>
            Probar cámara{!videoOnly && ", micrófono"} y conexión
          </Button>
        )}
      </div>

      {(running || camOk !== null || net) && (
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <video ref={videoRef} muted playsInline className="aspect-video w-full rounded bg-muted object-cover" />
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Cámara</span>
              <VerdictBadge v={camOk === null ? null : camOk ? "buena" : "mala"} />
            </li>
            {!videoOnly && (
              <li className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span>Micrófono (habla para probarlo)</span>
                  <VerdictBadge v={running || peak > 0 ? micVerdict(peak) : null} />
                </div>
                <Progress value={Math.min(100, level * 400)} aria-label="Nivel del micrófono" />
              </li>
            )}
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <Wifi className="h-3.5 w-3.5" aria-hidden /> Subida
                {net && <span className="text-muted-foreground"> · {net.upload} Mbit/s</span>}
              </span>
              {netBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <VerdictBadge v={net ? uploadVerdict(net.upload) : null} />}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>
                Latencia{net && <span className="text-muted-foreground"> · {net.latency} ms</span>}
              </span>
              {!netBusy && <VerdictBadge v={net ? latencyVerdict(net.latency) : null} />}
            </li>
            {netError && <li className="text-destructive">{netError}</li>}
            {net && uploadVerdict(net.upload) === "mala" && (
              <li className="text-muted-foreground">
                La conexión es lenta: la grabación se guarda en tu equipo y se sube por partes, pero
                conviene acercarse al router o usar cable.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
