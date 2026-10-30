/** Upload-Post accepts jobs before the social networks finish publishing. */
export type PublishResult = {
  platform: string;
  ok: boolean;
  detail: string;
  pending?: boolean;
  requestId?: string;
};

type PlatformResult = {
  platform?: string;
  success?: boolean;
  status?: string;
  url?: string;
  post_url?: string;
  error?: string;
  error_message?: string;
  error_code?: string;
  failure_stage?: string;
  message?: string;
  skipped?: boolean;
  skip_reason?: string;
  fallback_to_inbox?: boolean;
};

export type UploadResponse = {
  success?: boolean;
  status?: string;
  request_id?: string;
  message?: string;
  error?: string;
  results?: PlatformResult[] | Record<string, PlatformResult>;
};

/** Best available reason Upload-Post gives for a failed platform. */
function failureReason(r: PlatformResult): string {
  const text = r.error || r.error_message || (r.message && !/^(failed|error)$/i.test(r.message) ? r.message : "");
  if (text) return text;
  const code = [r.error_code, r.failure_stage].filter(Boolean).join(" / ");
  return code ? `La red rechazó la publicación (código: ${code}).` : "La red rechazó la publicación sin indicar el motivo. Revisa el historial de Upload-Post.";
}

export function uploadResults(json: UploadResponse, platforms: string[], httpOk: boolean, requestId?: string): PublishResult[] {
  const id = json.request_id || requestId;
  return platforms.map((platform) => {
    const r = Array.isArray(json.results) ? json.results.find((item) => item.platform === platform) : json.results?.[platform];
    if (!httpOk) return { platform, ok: false, detail: json.error || json.message || "Upload-Post no pudo confirmar el envío.", requestId: id };
    if (r?.skipped || r?.status === "skipped") return { platform, ok: false, detail: "Esta red no está conectada al perfil de Upload-Post.", requestId: id };
    if (r?.fallback_to_inbox) return { platform, ok: false, detail: "Enviado a borradores de TikTok; aún no está publicado en la red.", requestId: id };
    if (r?.status === "failed" || (r?.success === false && r.status !== "retryable"))
      return { platform, ok: false, detail: failureReason(r), requestId: id };

    const waiting = ["queued", "pending", "processing", "in_progress", "retryable"];
    const queuedMessage = /queued|processing|pending|accepted/i.test(r?.message ?? "");
    const url = r?.post_url || r?.url;
    const publicUrl = url && /^https:\/\//i.test(url) ? url : undefined;
    // Never interpret the top-level success flag as publication on every network.
    const confirmed = r && !waiting.includes(r.status ?? "") && !queuedMessage &&
      (r.status === "completed" || (r.success === true && (Boolean(publicUrl) || json.status === "completed" || /published/i.test(r.message ?? ""))));
    if (confirmed) return { platform, ok: true, detail: publicUrl || "Publicación confirmada por Upload-Post.", requestId: id };
    if (json.status === "failed") return { platform, ok: false, detail: r?.error || json.message || "Upload-Post informa que el envío ha fallado.", requestId: id };
    return { platform, ok: false, pending: true, detail: id ? "En proceso; publicación todavía sin confirmar." : "Sin confirmación de publicación. Consulta el historial de Upload-Post antes de volver a enviar.", requestId: id };
  });
}

const TRACKING = "Upload-Post seguimiento: ";

export function readPublishTracking(result: string | null): PublishResult[] {
  const line = result?.split("\n").find((value) => value.startsWith(TRACKING));
  if (!line) return [];
  try {
    const parsed: unknown = JSON.parse(line.slice(TRACKING.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is PublishResult => r && typeof r.platform === "string" && typeof r.ok === "boolean" && typeof r.detail === "string" && (r.requestId === undefined || typeof r.requestId === "string"));
  } catch { return []; }
}

export function summarize(results: PublishResult[]): { status: "publicado" | "enviando" | "error"; result: string } {
  const status = results.length > 0 && results.every((r) => r.ok) ? "publicado" : results.some((r) => r.pending) ? "enviando" : "error";
  const lines = results.map((r) => `${r.platform}: ${r.ok ? "✓" : r.pending ? "…" : "✗"} ${r.detail}`);
  if (results.some((r) => r.requestId)) lines.push(TRACKING + JSON.stringify(results));
  return { status, result: lines.join("\n") };
}

export function visiblePublishResult(result: string): string {
  return result.split("\n").filter((line) => !line.startsWith(TRACKING)).join("\n");
}