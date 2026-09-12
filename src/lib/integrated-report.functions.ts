import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { xdb, xAdminDb } from "./assessments-repo.server";
import {
  alignAnswersWithRecording,
  buildCompetencySignals,
  pickCaptureForSession,
  type IntegratedReport,
} from "./integrated-report.server";

const CAPTURE_COLUMNS = "id, title, mode, started_at, ended_at, created_at, game_session_id, simulation_id";

/**
 * Informe integrado: decisiones de la simulación + análisis de la grabación,
 * alineados por marca de tiempo. Devuelve `null` si el llamante no es el
 * propietario de la simulación o no hay grabación vinculable.
 */
export const getIntegratedReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({
        sessionId: z.string().uuid().optional(),
        captureSessionId: z.string().uuid().optional(),
      })
      .refine((d) => !!d.sessionId || !!d.captureSessionId, {
        message: "Indica una sesión de juego o una grabación",
      })
      .parse(v),
  )
  .handler(async ({ data, context }): Promise<IntegratedReport | null> => {
    let gameSessionId = data.sessionId ?? null;
    let captureRow: any = null;
    let linkedExplicitly = false;

    if (!gameSessionId && data.captureSessionId) {
      const { data: cap, error } = await xdb(context)
        .from("capture_sessions")
        .select(CAPTURE_COLUMNS)
        .eq("id", data.captureSessionId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!cap) return null;
      captureRow = cap;
      if (cap.game_session_id) {
        gameSessionId = cap.game_session_id;
        linkedExplicitly = true;
      } else if (cap.simulation_id) {
        const { data: candidates } = await xdb(context)
          .from("sessions")
          .select("id, started_at")
          .eq("simulation_id", cap.simulation_id)
          .not("completed_at", "is", null)
          .order("started_at", { ascending: false })
          .limit(20);
        const ref = cap.started_at ?? cap.created_at;
        const best = (candidates ?? [])
          .map((s) => ({
            s,
            dist:
              ref && s.started_at
                ? Math.abs(new Date(s.started_at).getTime() - new Date(ref).getTime())
                : Number.POSITIVE_INFINITY,
          }))
          .sort((a, b) => a.dist - b.dist)[0];
        if (!best || best.dist > 6 * 3600 * 1000) return null;
        gameSessionId = best.s.id;
      } else {
        return null;
      }
    }

    if (!gameSessionId) return null;

    const { data: sess, error: sErr } = await xdb(context)
      .from("sessions")
      .select(
        "id, simulation_id, score, stars, report, answers, competency_scores, started_at, completed_at, admin_feedback, candidate_name, candidate_email, simulation:simulations(id, owner_id, title, objective, evaluation_criteria)",
      )
      .eq("id", gameSessionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sess) return null;

    const sim = (sess as any).simulation;
    if (!sim || sim.owner_id !== context.userId) return null;

    if (!captureRow) {
      const { data: captures, error: cErr } = await xdb(context)
        .from("capture_sessions")
        .select(CAPTURE_COLUMNS)
        .eq("owner_id", context.userId)
        .eq("simulation_id", sess.simulation_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cErr) throw new Error(cErr.message);
      const picked = pickCaptureForSession(captures ?? [], sess.started_at, sess.id);
      if (picked) {
        captureRow = picked.row;
        linkedExplicitly = picked.linkedExplicitly;
      }
    }

    let metrics: any = null;
    let interactions: any = null;
    let insights: any = null;
    let segments: any[] = [];
    let participants: any[] = [];

    if (captureRow) {
      const [analysisRes, segRes, partRes] = await Promise.all([
        xdb(context)
          .from("capture_analyses")
          .select("metrics, interactions, insights, insights_generated_at")
          .eq("capture_session_id", captureRow.id)
          .eq("owner_id", context.userId)
          .maybeSingle(),
        xdb(context)
          .from("capture_transcript_segments")
          .select("participant_id, speaker_label, start_sec, end_sec, text")
          .eq("capture_session_id", captureRow.id)
          .eq("owner_id", context.userId)
          .order("start_sec", { ascending: true })
          .limit(1500),
        xdb(context)
          .from("capture_participants")
          .select("id, name, role")
          .eq("capture_session_id", captureRow.id)
          .eq("owner_id", context.userId),
      ]);
      metrics = analysisRes.data?.metrics ?? null;
      interactions = analysisRes.data?.interactions ?? null;
      const rawInsights = analysisRes.data?.insights;
      insights =
        rawInsights && typeof rawInsights === "object" && Object.keys(rawInsights).length > 0
          ? { ...(rawInsights as any), generatedAt: analysisRes.data?.insights_generated_at ?? null }
          : null;
      segments = segRes.data ?? [];
      participants = partRes.data ?? [];
    }

    const nameOf = (key: string | null | undefined) => {
      if (!key) return "Hablante sin identificar";
      const p = participants.find((x) => x.id === key);
      return p ? p.name : key;
    };

    const criteriaLabels = Object.fromEntries(
      ((sim.evaluation_criteria ?? []) as any[]).map((c) => [c.key, c.label]),
    ) as Record<string, string>;

    const competencyScores = (sess.competency_scores ?? {}) as Record<string, number>;
    const answers = Array.isArray(sess.answers) ? (sess.answers as any[]) : [];

    return {
      simulation: { id: sim.id, title: sim.title, objective: sim.objective ?? null },
      candidate: { name: sess.candidate_name ?? null, email: sess.candidate_email ?? null },
      gameSession: {
        id: sess.id,
        startedAt: sess.started_at ?? null,
        completedAt: sess.completed_at ?? null,
        adminFeedback: sess.admin_feedback ?? null,
        score: sess.score ?? 0,
        stars: sess.stars ?? 0,
        report: sess.report ?? null,
        competencyScores,
      },
      criteriaLabels,
      capture: captureRow
        ? {
            id: captureRow.id,
            title: captureRow.title,
            startedAt: captureRow.started_at ?? null,
            endedAt: captureRow.ended_at ?? null,
            mode: captureRow.mode,
            linkedExplicitly,
          }
        : null,
      metrics,
      interactions,
      insights,
      timeline: alignAnswersWithRecording(
        answers,
        captureRow?.started_at ?? captureRow?.created_at ?? null,
        segments as any,
        nameOf,
      ),
      competencies: buildCompetencySignals(competencyScores, criteriaLabels, insights),
    };
  });

/** Vincula explícitamente una grabación con la sesión de juego que la acompaña. */
export const linkCaptureGameSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z
      .object({ captureSessionId: z.string().uuid(), gameSessionId: z.string().uuid() })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: sess } = await xdb(context)
      .from("sessions")
      .select("id")
      .eq("id", data.gameSessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!sess) return { linked: false as const, reason: "session_not_found" as const };

    const supabaseAdmin = await xAdminDb();

    const { data: cap } = await supabaseAdmin
      .from("capture_sessions")
      .select("id, owner_id, game_session_id")
      .eq("id", data.captureSessionId)
      .maybeSingle();
    if (!cap) return { linked: false as const, reason: "capture_not_found" as const };

    if (cap.owner_id !== context.userId) {
      const { data: part } = await supabaseAdmin
        .from("capture_participants")
        .select("id")
        .eq("capture_session_id", data.captureSessionId)
        .eq("user_id", context.userId)
        .limit(1)
        .maybeSingle();
      if (!part) return { linked: false as const, reason: "forbidden" as const };
    }

    if (cap.game_session_id) return { linked: false as const, reason: "already" as const };

    const { error } = await supabaseAdmin
      .from("capture_sessions")
      .update({ game_session_id: data.gameSessionId })
      .eq("id", data.captureSessionId);
    if (error) throw new Error(error.message);
    return { linked: true as const };
  });
