import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Activity, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

export type PeerDiagnostics = {
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
  /** host = red local, srflx = STUN, relay = TURN */
  localCandidateType?: string;
  remoteCandidateType?: string;
  transport?: string;
  usingTurn: boolean;
  roundTripMs?: number;
  packetsLostPct?: number;
  inboundKbps?: number;
  frameWidth?: number;
  frameHeight?: number;
  fps?: number;
  lastError?: string;
};

export type DiagnosticsRow = {
  id: string;
  name: string;
  isSelf?: boolean;
  connectionState: RTCPeerConnectionState;
  hasVideo: boolean;
  diagnostics?: PeerDiagnostics;
};

const STATE_LABEL: Record<string, string> = {
  new: "Iniciando",
  connecting: "Conectando",
  connected: "Conectado",
  completed: "Conectado",
  checking: "Comprobando",
  disconnected: "Desconectado",
  failed: "Error",
  closed: "Cerrado",
};

function stateVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "connected" || state === "completed") return "default";
  if (state === "failed" || state === "closed") return "destructive";
  if (state === "disconnected") return "outline";
  return "secondary";
}

function qualityOf(d?: PeerDiagnostics): { label: string; tone: string } {
  if (!d) return { label: "Sin datos", tone: "text-muted-foreground" };
  const rtt = d.roundTripMs ?? 0;
  const loss = d.packetsLostPct ?? 0;
  if (d.iceConnectionState === "failed") return { label: "Sin conexión", tone: "text-destructive" };
  if (loss > 5 || rtt > 400) return { label: "Baja", tone: "text-destructive" };
  if (loss > 2 || rtt > 200) return { label: "Media", tone: "text-amber-500" };
  if (rtt === 0 && !d.inboundKbps) return { label: "Midiendo…", tone: "text-muted-foreground" };
  return { label: "Buena", tone: "text-emerald-500" };
}

const fmt = (v: number | undefined, unit: string, digits = 0) =>
  v === undefined || Number.isNaN(v) ? "—" : `${v.toFixed(digits)}${unit}`;

/**
 * Panel de diagnóstico de la sala: estado real de ICE/TURN, calidad y errores por
 * participante. Es una tabla apilable, legible tanto en móvil como en PC.
 */
export function MosaicDiagnosticsPanel({ rows }: { rows: DiagnosticsRow[] }) {
  function copyReport() {
    const text = rows
      .map((r) => {
        const d = r.diagnostics;
        return [
          `${r.name}${r.isSelf ? " (tú)" : ""}`,
          `  conexión: ${r.connectionState}`,
          `  ice: ${d?.iceConnectionState ?? "—"} / gathering: ${d?.iceGatheringState ?? "—"} / signaling: ${d?.signalingState ?? "—"}`,
          `  ruta: ${d?.localCandidateType ?? "—"} → ${d?.remoteCandidateType ?? "—"} (${d?.transport ?? "—"})${d?.usingTurn ? " [TURN]" : ""}`,
          `  rtt: ${fmt(d?.roundTripMs, " ms")} · pérdida: ${fmt(d?.packetsLostPct, " %", 1)} · bitrate: ${fmt(d?.inboundKbps, " kbps")}`,
          `  vídeo: ${d?.frameWidth ?? "—"}x${d?.frameHeight ?? "—"} @ ${fmt(d?.fps, " fps")}`,
          d?.lastError ? `  error: ${d.lastError}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    void navigator.clipboard
      .writeText(text || "Sin participantes")
      .then(() => toast.success("Diagnóstico copiado"))
      .catch(() => toast.error("No se pudo copiar el diagnóstico"));
  }

  return (
    <Collapsible className="rounded-lg border border-border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> Diagnóstico de conexión
            <Badge variant="secondary">{rows.length}</Badge>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-border p-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Entra en la sala para ver el estado de conexión de cada participante.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {rows.map((row) => {
                  const d = row.diagnostics;
                  const quality = qualityOf(d);
                  return (
                    <li key={row.id} className="rounded-md bg-muted/40 p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {row.name}
                          {row.isSelf ? " (tú)" : ""}
                        </span>
                        <Badge variant={stateVariant(row.connectionState)}>
                          {STATE_LABEL[row.connectionState] ?? row.connectionState}
                        </Badge>
                        {d?.usingTurn && <Badge variant="outline">Relé TURN</Badge>}
                        {!row.isSelf && !row.hasVideo && (
                          <Badge variant="outline">Sin vídeo entrante</Badge>
                        )}
                        <span className={`ml-auto font-medium ${quality.tone}`}>
                          Calidad: {quality.label}
                        </span>
                      </div>
                      {row.isSelf ? (
                        <p className="mt-2 text-muted-foreground">
                          Tu cámara es local: no necesita conexión P2P.
                        </p>
                      ) : (
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                          <Item label="ICE" value={d?.iceConnectionState ?? "—"} />
                          <Item label="Candidatos" value={d?.iceGatheringState ?? "—"} />
                          <Item label="Señalización" value={d?.signalingState ?? "—"} />
                          <Item
                            label="Ruta"
                            value={`${d?.localCandidateType ?? "—"} → ${d?.remoteCandidateType ?? "—"}`}
                          />
                          <Item label="Transporte" value={d?.transport ?? "—"} />
                          <Item label="Latencia" value={fmt(d?.roundTripMs, " ms")} />
                          <Item label="Pérdida" value={fmt(d?.packetsLostPct, " %", 1)} />
                          <Item label="Bitrate" value={fmt(d?.inboundKbps, " kbps")} />
                          <Item
                            label="Vídeo"
                            value={
                              d?.frameWidth
                                ? `${d.frameWidth}x${d.frameHeight} @ ${fmt(d.fps, "", 0)}fps`
                                : "—"
                            }
                          />
                        </dl>
                      )}
                      {d?.lastError && (
                        <p className="mt-2 text-destructive" role="status">
                          {d.lastError}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copyReport}>
                <Copy className="h-3.5 w-3.5" /> Copiar diagnóstico
              </Button>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
