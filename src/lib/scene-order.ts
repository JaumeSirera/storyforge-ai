import type { Story, StoryNode } from "./story-types";

/**
 * Computes a chronological scene number (1..N) for each node.
 * Order is determined by a BFS from `startNodeId`, following question choices.
 * Unreachable nodes are appended at the end preserving their insertion order.
 */
export function computeSceneOrder(story: Story | null | undefined): Map<string, number> {
  const order = new Map<string, number>();
  if (!story || !story.nodes) return order;
  const nodes = story.nodes;
  const visited = new Set<string>();
  const queue: string[] = [];
  if (story.startNodeId && nodes[story.startNodeId]) queue.push(story.startNodeId);

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id) || !nodes[id]) continue;
    visited.add(id);
    order.set(id, order.size + 1);
    const choices = nodes[id].question?.choices ?? [];
    for (const c of choices) {
      if (c.next && nodes[c.next] && !visited.has(c.next)) queue.push(c.next);
    }
  }

  for (const id of Object.keys(nodes)) {
    if (!visited.has(id)) order.set(id, order.size + 1);
  }
  return order;
}

/**
 * Returns nodes sorted by their chronological order.
 */
export function sortNodesByOrder(nodes: StoryNode[], order: Map<string, number>): StoryNode[] {
  return [...nodes].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
}

export function sceneLabel(order: Map<string, number>, id: string, title?: string): string {
  const n = order.get(id);
  const prefix = n ? `Escena ${n}` : "Escena";
  return title ? `${prefix} — ${title}` : prefix;
}
