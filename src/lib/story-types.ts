// Shared story / simulation types used by client and server.

export type VideoSource =
  | { type: "youtube"; url: string; startSec?: number; endSec?: number }
  | { type: "vimeo"; url: string; startSec?: number; endSec?: number }
  | { type: "mp4"; url: string; startSec?: number; endSec?: number }
  | { type: "none" };

export interface VideoClip {
  id: string;
  label: string;
  source: VideoSource;
}

export interface Choice {
  id: string;
  label: string;
  feedback: string;
  points: number; // can be negative
  next: string | null; // next node id, null = ending
  competencies: Record<string, number>; // competency -> delta
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
  question?: {
    text: string;
    choices: Choice[];
  };
  isEnding?: boolean;
  endingType?: "success" | "neutral" | "fail";
}

export interface Story {
  startNodeId: string;
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
