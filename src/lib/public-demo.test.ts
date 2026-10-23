import { describe, expect, test } from "bun:test";
import { demoStory } from "./public-demo";
import { resolveChoiceDestination } from "./story-types";

describe("Public landing simulation", () => {
  test("can reach a final result using only local story data without an account", () => {
    const start = demoStory.nodes[demoStory.startNodeId];
    expect(start.question?.choices.length).toBeGreaterThan(0);
    for (const first of start.question?.choices ?? []) {
      const destination = resolveChoiceDestination(first);
      expect(destination.kind).toBe("scene");
      const next = destination.nodeId ? demoStory.nodes[destination.nodeId] : undefined;
      expect(next?.question?.choices.length).toBeGreaterThan(0);
      for (const last of next?.question?.choices ?? []) {
        expect(resolveChoiceDestination(last).kind).toBe("end");
      }
    }
  });
});