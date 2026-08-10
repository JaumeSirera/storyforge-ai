import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type CaptureControlAction = "start" | "pause" | "resume" | "stop";

export interface CaptureControlMessage {
  action: CaptureControlAction;
  /** Marca de tiempo del anfitrión (ms) para alinear los inicios. */
  at: number;
}

export function captureControlChannelName(captureSessionId: string) {
  return `capture-control-${captureSessionId}`;
}

/** Canal de control compartido: el anfitrión emite, los participantes obedecen. */
export function joinCaptureControlChannel(
  captureSessionId: string,
  onMessage?: (msg: CaptureControlMessage) => void,
): RealtimeChannel {
  const channel = supabase.channel(captureControlChannelName(captureSessionId), {
    config: { broadcast: { self: false } },
  });
  if (onMessage) {
    channel.on("broadcast", { event: "control" }, ({ payload }) => {
      const msg = payload as CaptureControlMessage;
      if (msg && typeof msg.action === "string") onMessage(msg);
    });
  }
  channel.subscribe();
  return channel;
}

export async function sendCaptureControl(
  channel: RealtimeChannel | null,
  action: CaptureControlAction,
) {
  if (!channel) return;
  await channel.send({
    type: "broadcast",
    event: "control",
    payload: { action, at: Date.now() } satisfies CaptureControlMessage,
  });
}
