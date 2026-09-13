import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { xdb, xAdminDb } from "./assessments-repo.server";

export const REVIEW_STATUSES = ["pending", "validated", "adjusted", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_CONFIDENCES = ["alta", "media", "baja"] as const;
export type ReviewConfidence = (typeof REVIEW_CONFIDENCES)[number];

/** Revisión profesional de una hipótesis del informe. */
export type HypothesisReview = {
  id: string;
  hypothesisIndex: number;
  hypothesisText: string;
  status: ReviewStatus;
  adjustedText: string;
  confidence: ReviewConfidence;
  comment: string;
  updatedAt: string;
};

/** Entrada del historial de cambios de una hipótesis. */
export type HypothesisReviewEvent = {
  id: string;
  hypothesisIndex: number;
  action: string;
  status: ReviewStatus;
  adjustedText: string;
  confidence: ReviewConfidence;
  comment: string;
  createdAt: string;
};

const REVIEW_COLUMNS =
  "id, hypothesis_index, hypothesis_text, status, adjusted_text, confidence, comment, updated_at";
const EVENT_COLUMNS =
  "id, hypothesis_index, action, status, adjusted_text, confidence, comment, created_at";

function mapReview(row: any): HypothesisReview {
  return {
    id: row.id,
    hypothesisIndex: row.hypothesis_index,
    hypothesisText: row.hypothesis_text ?? "",
    status: (row.status ?? "pending") as ReviewStatus,
    adjustedText: row.adjusted_text ?? "",
    confidence: (row.confidence ?? "media") as ReviewConfidence,
    comment: row.comment ?? "",
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: any): HypothesisReviewEvent {
  return {
    id: row.id,
    hypothesisIndex: row.hypothesis_index,
    action: row.action ?? "update",
    status: (row.status ?? "pending") as ReviewStatus,
    adjustedText: row.adjusted_text ?? "",
    confidence: (row.confidence ?? "media") as ReviewConfidence,
    comment: row.comment ?? "",
    createdAt: row.created_at,
  };
}

/** Lista las revisiones de hipótesis y su historial completo de cambios. */
export const listHypothesisReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ captureSessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [reviewsRes, eventsRes] = await Promise.all([
      xdb(context)
        .from("capture_hypothesis_reviews")
        .select(REVIEW_COLUMNS)
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .order("hypothesis_index", { ascending: true }),
      xdb(context)
        .from("capture_hypothesis_review_events")
        .select(EVENT_COLUMNS)
        .eq("capture_session_id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    if (reviewsRes.error) throw new Error(reviewsRes.error.message);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    return {
      reviews: (reviewsRes.data ?? []).map(mapReview),
      events: (eventsRes.data ?? []).map(mapEvent),
    };
  });

/** Guarda la validación o el ajuste de una hipótesis y añade una entrada al historial. */
export const saveHypothesisReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        captureSessionId: z.string().uuid(),
        hypothesisIndex: z.number().int().min(0).max(999),
        hypothesisText: z.string().max(2000).default(""),
        status: z.enum(REVIEW_STATUSES),
        adjustedText: z.string().max(2000).default(""),
        confidence: z.enum(REVIEW_CONFIDENCES),
        comment: z.string().max(4000).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      capture_session_id: data.captureSessionId,
      owner_id: context.userId,
      hypothesis_index: data.hypothesisIndex,
      hypothesis_text: data.hypothesisText.trim(),
      status: data.status,
      adjusted_text: data.adjustedText.trim() || null,
      confidence: data.confidence,
      comment: data.comment.trim(),
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await xdb(context)
      .from("capture_hypothesis_reviews")
      .select("id")
      .eq("capture_session_id", data.captureSessionId)
      .eq("owner_id", context.userId)
      .eq("hypothesis_index", data.hypothesisIndex)
      .maybeSingle();

    const { data: row, error } = await xdb(context)
      .from("capture_hypothesis_reviews")
      .upsert(payload, { onConflict: "capture_session_id,hypothesis_index" })
      .select(REVIEW_COLUMNS)
      .single();
    if (error) throw new Error(error.message);

    const { error: evError } = await xdb(context)
      .from("capture_hypothesis_review_events")
      .insert({
        review_id: row.id,
        capture_session_id: data.captureSessionId,
        owner_id: context.userId,
        hypothesis_index: data.hypothesisIndex,
        action: existing ? "update" : "create",
        status: data.status,
        adjusted_text: payload.adjusted_text,
        confidence: data.confidence,
        comment: payload.comment,
      });
    if (evError) throw new Error(evError.message);

    return { review: mapReview(row) };
  });
