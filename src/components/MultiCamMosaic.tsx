import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid2x2, Mic, MicOff, Video, VideoOff, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PreviewViewControls, usePreviewView } from "./PreviewViewControls";
import {
  MosaicDiagnosticsPanel,
  type DiagnosticsRow,
  type PeerDiagnostics,
} from "./MosaicDiagnosticsPanel";


type PeerState = {
  id: string;
  name: string;
  stream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  diagnostics?: PeerDiagnostics;
};


/**
 * STUN descubre la IP pública; TURN reenvía el vídeo cuando los dispositivos
 * están en redes distintas (móvil 4G ↔ PC con router/NAT estricto), que es el
 * caso en el que antes las cámaras se quedaban en negro.
 */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

const waitForIceGathering = (pc: RTCPeerConnection) =>
  new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const finish = () => {
      if (pc.iceGatheringState !== "complete") return;
      pc.removeEventListener("icegatheringstatechange", finish);
      resolve();
    };
    pc.addEventListener("icegatheringstatechange", finish);
    window.setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", finish);
      resolve();
    }, 5000);
  });

type InboundSample = { bytes: number; at: number };

/** Lee las estadísticas reales de la conexión (ICE/TURN, latencia, pérdida, vídeo). */
async function collectDiagnostics(
  pc: RTCPeerConnection,
  prevSample: InboundSample | undefined,
  lastError: string | undefined,
): Promise<{ diagnostics: PeerDiagnostics; sample?: InboundSample }> {
  const diagnostics: PeerDiagnostics = {
    iceConnectionState: pc.iceConnectionState,
    iceGatheringState: pc.iceGatheringState,
    signalingState: pc.signalingState,
    usingTurn: false,
    lastError,
  };
  let sample: InboundSample | undefined;
  try {
    const stats = await pc.getStats();
    const byId = new Map<string, any>();
    stats.forEach((report: any) => byId.set(report.id, report));
    stats.forEach((report: any) => {
      if (report.type === "candidate-pair" && (report.selected || report.state === "succeeded")) {
        const local = report.localCandidateId ? byId.get(report.localCandidateId) : undefined;
        const remote = report.remoteCandidateId ? byId.get(report.remoteCandidateId) : undefined;
        if (local?.candidateType) diagnostics.localCandidateType = local.candidateType;
        if (remote?.candidateType) diagnostics.remoteCandidateType = remote.candidateType;
        diagnostics.transport = local?.relayProtocol ?? local?.protocol ?? report.protocol;
        diagnostics.usingTurn =
          local?.candidateType === "relay" || remote?.candidateType === "relay";
        if (typeof report.currentRoundTripTime === "number")
          diagnostics.roundTripMs = report.currentRoundTripTime * 1000;
      }
      if (report.type === "inbound-rtp" && report.kind === "video") {
        const received = (report.packetsReceived ?? 0) + (report.packetsLost ?? 0);
        if (received > 0)
          diagnostics.packetsLostPct = ((report.packetsLost ?? 0) / received) * 100;
        if (typeof report.frameWidth === "number") diagnostics.frameWidth = report.frameWidth;
        if (typeof report.frameHeight === "number") diagnostics.frameHeight = report.frameHeight;
        if (typeof report.framesPerSecond === "number") diagnostics.fps = report.framesPerSecond;
        const bytes = report.bytesReceived ?? 0;
        const at = report.timestamp ?? Date.now();
        sample = { bytes, at };
        if (prevSample && at > prevSample.at) {
          diagnostics.inboundKbps =
            ((bytes - prevSample.bytes) * 8) / ((at - prevSample.at) / 1000) / 1000;
        }
      }
    });
  } catch {
    diagnostics.lastError = lastError ?? "No se pudieron leer las estadísticas de la conexión.";
  }
  return { diagnostics, sample };
}


/**
 * Mosaico multicámara en tiempo real (malla WebRTC).
 * La señalización viaja por un canal Realtime del backend; el vídeo/audio es P2P.
 */
export function MultiCamMosaic({
  captureSessionId,
  displayName,
}: {
  captureSessionId: string;
  displayName: string;
}) {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const preview = usePreviewView("pn-preview-view-mosaic");

  const selfId = useMemo(
    () => (typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random())),
    [],
  );
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const namesRef = useRef<Map<string, string>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const restartAttemptsRef = useRef<Map<string, number>>(new Map());
  const statsSampleRef = useRef<Map<string, InboundSample>>(new Map());
  const peerErrorsRef = useRef<Map<string, string>>(new Map());


  const upsertPeer = useCallback((id: string, patch: Partial<PeerState>) => {
    setPeers((prev) => {
      const found = prev.find((p) => p.id === id);
      if (found) return prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      return [
        ...prev,
        {
          id,
          name: namesRef.current.get(id) ?? "Participante",
          stream: null,
          connectionState: "new",
          ...patch,
        },
      ];
    });
  }, []);

  const flushPendingIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(peerId) ?? [];
    pendingIceRef.current.delete(peerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Un candidato de una negociación anterior puede haber caducado.
      }
    }
  }, []);

  const send = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      channelRef.current?.send({ type: "broadcast", event, payload: { from: selfId, ...payload } });
    },
    [selfId],
  );

  const createPeer = useCallback(
    (peerId: string, initiator: boolean) => {
      const existing = pcsRef.current.get(peerId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(peerId, pc);

      const localStream = localStreamRef.current;
      if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate) send("ice", { to: peerId, candidate: e.candidate.toJSON() });
      };
      pc.addEventListener("icecandidateerror", (event: any) => {
        // 701 en TURN suele indicar bloqueo del relé por la red del participante.
        peerErrorsRef.current.set(
          peerId,
          `ICE ${event?.errorCode ?? ""}: ${event?.errorText || "fallo al obtener candidatos"} (${event?.url ?? "sin URL"})`,
        );
      });
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          peerErrorsRef.current.delete(peerId);
        }
      };


      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;
        const stream = remoteStream ?? new MediaStream([e.track]);
        upsertPeer(peerId, { stream });
      };
      pc.onconnectionstatechange = () => {
        upsertPeer(peerId, { connectionState: pc.connectionState });
        if (pc.connectionState === "connected") restartAttemptsRef.current.delete(peerId);
        if (pc.connectionState === "failed") {
          const attempts = restartAttemptsRef.current.get(peerId) ?? 0;
          // El iniciador determinista renegocia una vez con ICE restart.
          if (initiator && attempts < 1) {
            restartAttemptsRef.current.set(peerId, attempts + 1);
            void (async () => {
              try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                await waitForIceGathering(pc);
                send("offer", { to: peerId, sdp: pc.localDescription?.sdp, name: displayName });
              } catch {
                upsertPeer(peerId, { connectionState: "failed" });
              }
            })();
            return;
          }
        }
        if (pc.connectionState === "closed") {
          pcsRef.current.delete(peerId);
          setPeers((prev) => prev.filter((p) => p.id !== peerId));
        }
      };


      if (initiator) {
        void (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // Incluye en el SDP los candidatos TURN aunque el trickle llegue desordenado.
          await waitForIceGathering(pc);
          send("offer", { to: peerId, sdp: pc.localDescription?.sdp, name: displayName });
        })();
      }
      upsertPeer(peerId, {});
      return pc;
    },
    [displayName, send, upsertPeer],
  );

  const leave = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingIceRef.current.clear();
    restartAttemptsRef.current.clear();
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setPeers([]);
    setJoined(false);
  }, []);

  const join = useCallback(async () => {
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setCamOn(true);
      setMicOn(true);

      const channel = supabase.channel(`capture-room-${captureSessionId}`, {
        config: { broadcast: { self: false }, presence: { key: selfId } },
      });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          const { from, to, sdp, name } = payload as Record<string, string>;
          if (to !== selfId || !from) return;
          if (name) namesRef.current.set(from, name);
          const pc = createPeer(from, false);
          await pc.setRemoteDescription({ type: "offer", sdp });
           await flushPendingIce(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
           await waitForIceGathering(pc);
          send("answer", { to: from, sdp: pc.localDescription?.sdp, name: displayName });
          upsertPeer(from, { name: name ?? "Participante" });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          const { from, to, sdp, name } = payload as Record<string, string>;
          if (to !== selfId || !from) return;
          const pc = pcsRef.current.get(from);
          if (!pc || pc.signalingState === "stable") return;
          await pc.setRemoteDescription({ type: "answer", sdp });
           await flushPendingIce(from, pc);
          if (name) {
            namesRef.current.set(from, name);
            upsertPeer(from, { name });
          }
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          const { from, to, candidate } = payload as {
            from: string;
            to: string;
            candidate: RTCIceCandidateInit;
          };
          if (to !== selfId || !from) return;
           const pc = pcsRef.current.get(from);
           if (!pc?.remoteDescription) {
             const queued = pendingIceRef.current.get(from) ?? [];
             queued.push(candidate);
             pendingIceRef.current.set(from, queued);
             return;
           }
          try {
             await pc.addIceCandidate(candidate);
          } catch {
             /* candidato de una negociación anterior */
          }
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ id: string; name: string }>();
          const others = Object.values(state)
            .flat()
            .filter((m) => m.id && m.id !== selfId);
          for (const m of others) {
            namesRef.current.set(m.id, m.name);
            // Iniciador determinista: el id menor crea la oferta.
            createPeer(m.id, selfId < m.id);
          }
          const ids = new Set(others.map((m) => m.id));
          pcsRef.current.forEach((pc, id) => {
            if (!ids.has(id)) {
              pc.close();
              pcsRef.current.delete(id);
            }
          });
          setPeers((prev) =>
            prev
              .filter((p) => ids.has(p.id))
              .map((p) => ({ ...p, name: namesRef.current.get(p.id) ?? p.name })),
          );
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ id: selfId, name: displayName });
            setJoined(true);
          }
        });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo acceder a la cámara");
      leave();
    } finally {
      setConnecting(false);
    }
  }, [captureSessionId, createPeer, displayName, flushPendingIce, leave, selfId, send, upsertPeer]);

  useEffect(() => leave, [leave]);

  // Sondeo de estadísticas reales para el panel de diagnóstico.
  useEffect(() => {
    if (!joined) {
      statsSampleRef.current.clear();
      peerErrorsRef.current.clear();
      return;
    }
    let cancelled = false;
    const tick = async () => {
      const entries = Array.from(pcsRef.current.entries());
      const results = await Promise.all(
        entries.map(async ([id, pc]) => {
          const { diagnostics, sample } = await collectDiagnostics(
            pc,
            statsSampleRef.current.get(id),
            peerErrorsRef.current.get(id),
          );
          if (sample) statsSampleRef.current.set(id, sample);
          return [id, diagnostics] as const;
        }),
      );
      if (cancelled || results.length === 0) return;
      const map = new Map(results);
      setPeers((prev) =>
        prev.map((p) => (map.has(p.id) ? { ...p, diagnostics: map.get(p.id) } : p)),
      );
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [joined]);


  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }
  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }

  const total = peers.length + (joined ? 1 : 0);
  const cols =
    total <= 1 ? "grid-cols-1" : total <= 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Grid2x2 className="h-4 w-4" /> Mosaico multicámara en directo
        </CardTitle>
        <CardDescription>
          Cada participante abre esta sesión en su dispositivo y entra en la sala: las cámaras se
          ven todas a la vez, sin pasar por el servidor de grabación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {joined ? (
            <>
              <Button variant="outline" onClick={leave}>
                Salir de la sala
              </Button>
              <Button variant="outline" size="icon" onClick={toggleCam} aria-label="Cámara">
                {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={toggleMic} aria-label="Micrófono">
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" /> {total} en sala
              </Badge>
            </>
          ) : (
            <Button onClick={() => void join()} disabled={connecting} className="gap-2">
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Video className="h-4 w-4" />
              )}
              Entrar en la sala
            </Button>
          )}
        </div>

        <PreviewViewControls view={preview.view} onChange={preview.update} />

        <div className={`grid gap-3 ${cols}`}>
          <figure
            className={`relative overflow-hidden rounded-lg border border-border bg-muted ${preview.frameClass}`}
          >
            <video ref={localVideoRef} autoPlay playsInline muted className={preview.videoClass} />
            {!joined && (
              <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Tu cámara
              </span>
            )}
            <figcaption className="absolute bottom-1 left-1 rounded bg-background/80 px-2 py-0.5 text-xs">
              {displayName} (tú)
            </figcaption>
          </figure>

          {peers.map((p) => (
            <PeerTile key={p.id} peer={p} frameClass={preview.frameClass} />
          ))}
        </div>

        {joined && peers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esperando a que otros participantes entren en la sala…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PeerTile({ peer, frameClass }: { peer: PeerState; frameClass: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [mutedForAutoplay, setMutedForAutoplay] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = peer.stream ?? null;
    if (!peer.stream) return;
    video.muted = false;
    setMutedForAutoplay(false);
    void video.play().catch(() => {
      // Móvil y Safari suelen bloquear autoplay cuando el flujo incluye audio.
      video.muted = true;
      setMutedForAutoplay(true);
      void video.play();
    });
  }, [peer.stream]);

  function enableSound() {
    const video = ref.current;
    if (!video) return;
    video.muted = false;
    void video.play();
    setMutedForAutoplay(false);
  }

  return (
    <figure
      className={`relative overflow-hidden rounded-lg border border-border bg-muted ${frameClass}`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        onLoadedMetadata={(event) => void event.currentTarget.play().catch(() => undefined)}
        className="h-full w-full object-cover"
      />
      {!peer.stream && (
        <span className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          {peer.connectionState === "failed"
            ? "No se pudo conectar el vídeo"
            : peer.connectionState === "disconnected"
              ? "Reconectando…"
              : "Conectando…"}
        </span>
      )}
      <figcaption className="absolute bottom-1 left-1 rounded bg-background/80 px-2 py-0.5 text-xs">
        {peer.name}
      </figcaption>
      {mutedForAutoplay && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={enableSound}
          className="absolute right-2 top-2 h-8 gap-1.5"
          aria-label={`Activar sonido de ${peer.name}`}
        >
          <MicOff className="h-3.5 w-3.5" /> Activar sonido
        </Button>
      )}
    </figure>
  );
}
