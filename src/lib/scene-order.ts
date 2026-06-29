import type { Story, StoryNode } from "./story-types";

/**
 * Computes a chronological scene number (1..N) for each node.
 * Uses the manual `order` field on each node when present, falling back to
 * the insertion order of `Object.keys(nodes)`. The BFS-based numbering used
 * previously is gone: numbering is now stable and controlled by the editor.
 */
export function computeSceneOrder(story: Story | null | undefined): Map<string, number> {
  const order = new Map<string, number>();
  if (!story || !story.nodes) return order;
  const entries = Object.values(story.nodes);
  const sorted = [...entries].sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : Number.POSITIVE_INFINITY;
    const bo = typeof b.order === "number" ? b.order : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return 0; // keep insertion order for ties
  });
  sorted.forEach((n, i) => order.set(n.id, i + 1));
  return order;
}

/** Returns nodes sorted by their chronological order. */
export function sortNodesByOrder(nodes: StoryNode[], order: Map<string, number>): StoryNode[] {
  return [...nodes].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
}

export function sceneLabel(order: Map<string, number>, id: string, title?: string): string {
  const n = order.get(id);
  const prefix = n ? `Escena ${n}` : "Escena";
  return title ? `${prefix} — ${title}` : prefix;
}
