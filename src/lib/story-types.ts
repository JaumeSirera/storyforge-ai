// Shared story / simulation types used by client and server.

import type { CaptionTrack } from "./captions";



export type VideoSource =
  | { type: "youtube"; url: string; startSec?: number; endSec?: number }
  | { type: "vimeo"; url: string; startSec?: number; endSec?: number }
  | { type: "mp4"; url: string; startSec?: number; endSec?: number }
  | {
      type: "ai";
      /** Public/signed URL of the generated MP4, once ready. */
      url: string | null;
      status: "pending" | "ready" | "failed";
      /** Replicate prediction id (used to poll). */
      predictionId?: string;
      /** Storage path in the `videos` bucket, once persisted. */
      storagePath?: string;
      /** Prompt used to generate. */
      prompt?: string;
      /** Duration in seconds requested. */
      durationSec?: number;
      /** Optional error message when status = "failed". */
      error?: string;
      /** Reference character used as first frame (image-to-video). */
      characterId?: string;
      characterName?: string;
      /** Signed preview URL of the reference image (for UI display). */
      referenceImageUrl?: string;
      /** Voice dialogue synthesised with ElevenLabs and mixed over the muted clip. */
      dialogue?: {
        text: string;
        voiceId: string;
        voiceName?: string;
        audioUrl?: string | null;
        audioPath?: string;
        status?: "idle" | "generating" | "ready" | "failed";
        error?: string;
      };
      /** Optional lip-sync pass: video with mouths synced to the dialogue audio. */
      lipsync?: {
        status: "idle" | "generating" | "ready" | "failed";
        predictionId?: string;
        url?: string | null;
        storagePath?: string;
        progress?: number;
        error?: string;
      };
      startSec?: number;
      endSec?: number;
    }

  | { type: "none" };

export interface VideoClip {
  id: string;
  label: string;
  source: VideoSource;
}

/**
 * Destination after picking a choice:
 *  - "end": finish the simulation.
 *  - "scene": jump to `next` (node id) — legacy behaviour when `nextKind` is missing.
 *  - "continue": stay in the current scene, resume the video (later triggers can fire).
 *  - "question": stay in the current scene and force another question/comment (same node).
 */
export type ChoiceNextKind = "end" | "scene" | "continue" | "question";

export interface Choice {
  id: string;
  label: string;
  feedback: string;
  points: number; // can be negative
  next: string | null; // next node id (used when nextKind === "scene"); null when "end"
  competencies: Record<string, number>; // competency -> delta
  /** Explicit destination type. If missing, derived from `next` (null → end, else scene). */
  nextKind?: ChoiceNextKind;
  /** Target question id within the same node when nextKind === "question". */
  nextQuestionId?: string;
  /** Optional: when nextKind === "scene", start playback on this specific clip of the target scene. */
  nextClipId?: string;
}

/** Resolves the effective destination of a choice, handling legacy shape. */
export function resolveChoiceDestination(choice: Pick<Choice, "next" | "nextKind" | "nextQuestionId" | "nextClipId">): {
  kind: ChoiceNextKind;
  nodeId?: string;
  questionId?: string;
  clipId?: string;
} {
  const kind = choice.nextKind ?? (choice.next ? "scene" : "end");
  if (kind === "scene") return { kind: "scene", nodeId: choice.next ?? undefined, clipId: choice.nextClipId };
  if (kind === "question") return { kind: "question", questionId: choice.nextQuestionId };
  return { kind };
}

/**
 * When the question should be presented during playback.
 *  - immediate: as soon as the scene/clip is shown (default; legacy behaviour).
 *  - time: pause the video at `seconds` and show the question.
 *  - end: show the question when the video naturally ends.
 */
export type QuestionTrigger =
  | { mode: "immediate" }
  | { mode: "time"; seconds: number }
  | { mode: "end" };

/**
 * Kind of interaction at this point of the scene:
 *  - "question": user picks one of `choices` (default; legacy behaviour).
 *  - "comment": user writes free text that is stored with the answer for evaluation.
 *      Uses `choices[0]` as the outcome (points/feedback/next/competencies).
 *  - "goto": no user interaction. When the trigger fires, jumps to `choices[0].next`.
 */
export type QuestionKind = "question" | "comment" | "goto";

export interface Question {
  /** Stable id within the node. Optional for legacy single-question data. */
  id?: string;
  /** Type of prompt. Defaults to "question". */
  kind?: QuestionKind;
  /** Optional: bind the question to a specific clip of the scene. */
  clipId?: string;
  /** When to surface the question relative to the bound (or active) clip. */
  triggerAt?: QuestionTrigger;
  /** For comments, this is the prompt shown to the user (e.g. "Justifica tu decisión"). */
  text: string;
  /** For comments, optional hint about how the evaluator should score the response. */
  evaluationHint?: string;
  choices: Choice[];
}


export interface StoryNode {
  id: string;
  title: string;
  narrative: string;
  /** Legacy single-video field. Kept for backward compatibility. */
  video: VideoSource;
  /** Optional list of selectable video clips for this scene. If present, overrides `video` at playback. */
  videos?: VideoClip[];
  /** Manual chronological order (1..N). Falls back to insertion order if missing. */
  order?: number;
  /** Legacy single question. Kept for backward compatibility. */
  question?: Question;
  /** New multi-question model. Each question can be tied to a specific clip. */
  questions?: Question[];
  isEnding?: boolean;
  endingType?: "success" | "neutral" | "fail";
}

export interface Story {
  startNodeId: string;
  /** Manual ordering is only respected after the user explicitly drags scenes in the editor. */
  orderMode?: "title" | "manual";
  nodes: Record<string, StoryNode>;
}

export interface EvaluationCriterion {
  key: string; // e.g. "leadership"
  label: string; // human label
  description: string;
}

export interface SessionAnswer {
  nodeId: string;
  nodeTitle: string;
  question: string;
  choiceId: string;
  choiceLabel: string;
  points: number;
  feedback: string;
  at: string;
  /** Free text the user wrote when the prompt was a comment. */
  commentText?: string;
  /** Prompt kind at the moment of answering. */
  kind?: QuestionKind;
}

export interface SessionReport {
  finalScore: number;
  stars: number;
  outcome: "apto" | "apto_con_reservas" | "no_apto";
  summary: string;
  strengths: string[];
  improvements: string[];
  competencyScores: Record<string, number>;
  achievements: string[];
}

/** Returns the playable list of clips for a node (handles legacy single-video). */
export function nodeClips(node: Pick<StoryNode, "video" | "videos">): VideoClip[] {
  if (node.videos && node.videos.length > 0) return node.videos;
  return [{ id: "default", label: "Clip principal", source: node.video ?? { type: "none" } }];
}

/** Returns the canonical list of questions for a node (migrates legacy single `question`). */
export function nodeQuestions(node: Pick<StoryNode, "question" | "questions">): Question[] {
  if (node.questions && node.questions.length > 0) return node.questions;
  if (node.question) {
    return [{
      id: node.question.id ?? "q_default",
      clipId: node.question.clipId,
      text: node.question.text,
      choices: node.question.choices,
    }];
  }
  return [];
}

/** Picks the question to show given the currently active clip. */
export function activeQuestion(
  node: Pick<StoryNode, "question" | "questions">,
  activeClipId: string | undefined,
): Question | undefined {
  const qs = nodeQuestions(node);
  if (qs.length === 0) return undefined;
  if (activeClipId) {
    const tied = qs.find((q) => q.clipId === activeClipId);
    if (tied) return tied;
  }
  return qs.find((q) => !q.clipId) ?? qs[0];
}

/** Finds a choice anywhere in a node's questions (single or multiple). */
export function findChoiceInNode(
  node: Pick<StoryNode, "question" | "questions">,
  choiceId: string,
): { question: Question; choice: Choice } | null {
  for (const q of nodeQuestions(node)) {
    const choice = q.choices.find((c) => c.id === choiceId);
    if (choice) return { question: q, choice };
  }
  return null;
}

