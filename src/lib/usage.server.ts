/**
 * Server-only usage metering.
 * NEVER import from a .functions.ts at module scope — always dynamic `await import()`
 * or import only from other *.server.ts files.
 *
 * Records one billable event per AI action and updates the user's running balance.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type UsageAction = "text" | "image" | "video" | "lipsync" | "tts";
export type UsageProvider = "openai" | "gemini" | "replicate" | "elevenlabs";

export interface RecordUsageInput {
  userId: string;
  action: UsageAction;
  provider: UsageProvider;
  model?: string | null;
  simulationId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  seconds?: number | null;
  characters?: number | null;
  units?: number | null;
  /** true when the platform's admin keys were used (via profiles.use_platform_ai). */
  paysPlatform: boolean;
  metadata?: Record<string, unknown>;
}

interface PricingRow {
  openai_input_per_1k: number;
  openai_output_per_1k: number;
  gemini_input_per_1k: number;
  gemini_output_per_1k: number;
  replicate_video_per_second: number;
  replicate_lipsync_per_second: number;
  replicate_image_per_unit: number;
  elevenlabs_per_1k_chars: number;
  margin_user_pays_pct: number;
  margin_platform_pays_pct: number;
  subscription_included_cents: number;
}

let _pricingCache: { row: PricingRow; at: number } | null = null;

async function getPricing(): Promise<PricingRow> {
  if (_pricingCache && Date.now() - _pricingCache.at < 60_000) return _pricingCache.row;
  const { data, error } = await supabaseAdmin
    .from("pricing_config")
    .select(
      "openai_input_per_1k, openai_output_per_1k, gemini_input_per_1k, gemini_output_per_1k, replicate_video_per_second, replicate_lipsync_per_second, replicate_image_per_unit, elevenlabs_per_1k_chars, margin_user_pays_pct, margin_platform_pays_pct, subscription_included_cents",
    )
    .eq("id", true)
    .maybeSingle();
  if (error || !data) throw new Error("pricing_config no disponible");
  const row = data as unknown as PricingRow;
  _pricingCache = { row, at: Date.now() };
  return row;
}

/** Compute raw provider cost in cents given event units. */
function computeRawCents(input: RecordUsageInput, p: PricingRow): number {
  switch (input.action) {
    case "text": {
      const inTok = input.inputTokens ?? 0;
      const outTok = input.outputTokens ?? 0;
      const rateIn = input.provider === "openai" ? p.openai_input_per_1k : p.gemini_input_per_1k;
      const rateOut = input.provider === "openai" ? p.openai_output_per_1k : p.gemini_output_per_1k;
      return (inTok / 1000) * Number(rateIn) + (outTok / 1000) * Number(rateOut);
    }
    case "video":
      return (input.seconds ?? 0) * Number(p.replicate_video_per_second);
    case "lipsync":
      return (input.seconds ?? 0) * Number(p.replicate_lipsync_per_second);
    case "image":
      return (input.units ?? 1) * Number(p.replicate_image_per_unit);
    case "tts":
      return ((input.characters ?? 0) / 1000) * Number(p.elevenlabs_per_1k_chars);
  }
}

/**
 * Fire-and-forget-safe: writes a usage_events row and bumps user_billing balances.
 * Errors are logged but NOT thrown to keep AI flows resilient.
 */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  try {
    const p = await getPricing();
    const rawCents = computeRawCents(input, p);
    const marginPct = input.paysPlatform
      ? Number(p.margin_platform_pays_pct)
      : Number(p.margin_user_pays_pct);

    // If the platform paid for the API call, the user is billed for raw cost + margin.
    // If the user paid with their own keys, the user only owes the margin fee on top.
    const billableBase = input.paysPlatform ? rawCents : 0;
    const marginCents = rawCents * (marginPct / 100);
    const totalCents = billableBase + marginCents;

    const { error: insertErr } = await supabaseAdmin.from("usage_events").insert({
      user_id: input.userId,
      simulation_id: input.simulationId ?? null,
      action: input.action,
      provider: input.provider,
      model: input.model ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      seconds: input.seconds ?? null,
      characters: input.characters ?? null,
      units: input.units ?? null,
      cost_raw_cents: rawCents,
      margin_pct: marginPct,
      total_cents: totalCents,
      pays_platform: input.paysPlatform,
      metadata: (input.metadata ?? null) as never,
    });
    if (insertErr) {
      console.error("[usage] insert failed:", insertErr.message);
      return;
    }

    // Ensure user_billing row exists.
    await supabaseAdmin
      .from("user_billing")
      .upsert({ user_id: input.userId }, { onConflict: "user_id", ignoreDuplicates: true });

    // Apply to balances: first fill included_used up to subscription_included_cents,
    // spill the rest into extra_pending_cents.
    const { data: billing } = await supabaseAdmin
      .from("user_billing")
      .select("included_used_cents, extra_pending_cents")
      .eq("user_id", input.userId)
      .maybeSingle();

    const included = Number(billing?.included_used_cents ?? 0);
    const extra = Number(billing?.extra_pending_cents ?? 0);
    const includedCap = p.subscription_included_cents;
    const room = Math.max(0, includedCap - included);
    const toIncluded = Math.min(room, totalCents);
    const toExtra = totalCents - toIncluded;

    await supabaseAdmin
      .from("user_billing")
      .update({
        included_used_cents: included + toIncluded,
        extra_pending_cents: extra + toExtra,
      })
      .eq("user_id", input.userId);
  } catch (e) {
    console.error("[usage] recordUsage failed:", e);
  }
}

/** True if this user's AI calls are paid by the platform (uses admin keys). */
export async function userPaysPlatform(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("use_platform_ai")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.use_platform_ai;
}
