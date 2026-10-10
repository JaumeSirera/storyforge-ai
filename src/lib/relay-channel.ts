/**
 * Canal en directo propio (sustituye al de Lovable Cloud): misma forma de uso
 * que antes (.on, .subscribe, .send, .track, .presenceState) pero funciona por
 * sondeo contra el servidor propio.
 */

type Handler = (msg: { payload: any }) => void;

export interface RelayChannel {
  on(type: "broadcast" | "presence", filter: { event: string }, cb: Handler | (() => void)): RelayChannel;
  subscribe(cb?: (status: string) => void): RelayChannel;
  send(msg: { type: "broadcast"; event: string; payload: unknown }): Promise<void>;
  track(info: unknown): Promise<void>;
  presenceState<T = unknown>(): Record<string, T[]>;
  unsubscribe(): Promise<void>;
}

function roomId(name: string) {
  return name.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 190);
}

async function post(room: string, action: string, body: unknown) {
  const r = await fetch(`/api/relay/${room}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: action === "leave",
  });
  if (!r.ok) throw new Error(`relay ${r.status}`);
  return (await r.json()).data;
}

export function createRelayChannel(name: string, opts?: { presenceKey?: string }): RelayChannel {
  const room = roomId(name);
  const member = opts?.presenceKey ?? crypto.randomUUID();
  const broadcast = new Map<string, Handler[]>();
  const presenceCbs: (() => void)[] = [];
  let presence: Record<string, unknown> = {};
  let presenceSig = "";
  let info: unknown = null;
  let since = -1;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let interval = 600;

  async function tick(first = false, cb?: (s: string) => void) {
    if (stopped) return;
    try {
      const data = await post(room, "poll", { member, since, info });
      since = data.since;
      for (const m of data.messages as { event: string; payload: any }[]) {
        for (const h of broadcast.get(m.event) ?? []) h({ payload: m.payload });
      }
      presence = data.presence ?? {};
      const sig = JSON.stringify(Object.keys(presence).sort());
      if (sig !== presenceSig) {
        presenceSig = sig;
        presenceCbs.forEach((f) => f());
      }
      interval = (data.messages as unknown[]).length ? 300 : 700;
      if (first) cb?.("SUBSCRIBED");
    } catch {
      interval = 2000;
      if (first) cb?.("CHANNEL_ERROR");
    }
    if (!stopped) timer = setTimeout(() => void tick(), interval);
  }

  const ch: RelayChannel = {
    on(type, filter, cb) {
      if (type === "broadcast") {
        const list = broadcast.get(filter.event) ?? [];
        list.push(cb as Handler);
        broadcast.set(filter.event, list);
      } else presenceCbs.push(cb as () => void);
      return ch;
    },
    subscribe(cb) {
      void tick(true, cb);
      return ch;
    },
    async send(msg) {
      await post(room, "send", { member, event: msg.event, payload: msg.payload }).catch(() => {});
    },
    async track(i) {
      info = i;
      if (timer) clearTimeout(timer);
      await tick();
    },
    presenceState<T>() {
      const out: Record<string, T[]> = {};
      for (const [k, v] of Object.entries(presence)) out[k] = [v as T];
      return out;
    },
    async unsubscribe() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await post(room, "leave", { member }).catch(() => {});
    },
  };
  return ch;
}
