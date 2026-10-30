import { describe, expect, test } from "bun:test";
import { uploadResults, summarize, readPublishTracking } from "./social-publish-results";

describe("Social publication confirmation", () => {
  test("accepted Facebook submission is not a published chapter", () => {
    const results = uploadResults({ success: true, request_id: "job-1" }, ["facebook"], true);
    expect(results[0].ok).toBe(false);
    expect(summarize(results).status).toBe("enviando");
    expect(readPublishTracking(summarize(results).result)[0].requestId).toBe("job-1");
  });
  test("queued per-platform success is not publication", () => {
    expect(uploadResults({ status: "in_progress", results: [{ platform: "facebook", success: true, message: "Queued" }] }, ["facebook"], true)[0].ok).toBe(false);
  });
  test("completed Facebook result exposes its real post URL", () => {
    const results = uploadResults({ status: "completed", results: [{ platform: "facebook", success: true, post_url: "https://www.facebook.com/posts/123" }] }, ["facebook"], true);
    expect(results[0].detail).toBe("https://www.facebook.com/posts/123");
    expect(summarize(results).status).toBe("publicado");
  });
  test("Facebook rejection cannot inherit another network's success", () => {
    const results = uploadResults({ success: true, results: { linkedin: { success: true, url: "https://www.linkedin.com/posts/123" }, facebook: { success: false, error: "Page permission denied" } } }, ["linkedin", "facebook"], true);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[1].detail).toBe("Page permission denied");
    expect(summarize(results).status).toBe("error");
  });
  test("skipped Facebook is not published even when the overall job completed", () => {
    expect(uploadResults({ status: "completed", results: [{ platform: "facebook", success: true, skipped: true }] }, ["facebook"], true)[0].ok).toBe(false);
  });
  test("TikTok inbox fallback is not a live publication", () => {
    expect(uploadResults({ status: "completed", results: [{ platform: "tiktok", success: true, fallback_to_inbox: true }] }, ["tiktok"], true)[0].ok).toBe(false);
  });
  test("missing Facebook results do not inherit aggregate completion", () => {
    expect(uploadResults({ status: "completed", success: true, results: [] }, ["facebook"], true)[0].ok).toBe(false);
  });
  test("failed asynchronous job reports a failure rather than pending", () => {
    expect(summarize(uploadResults({ status: "failed", message: "Upload failed", results: [] }, ["facebook"], true)).status).toBe("error");
  });
});
test("Facebook failure without text still shows Upload-Post's error code", () => {
  const r = uploadResults({ status: "completed", results: [{ platform: "facebook", status: "failed", error_code: "video_aspect_ratio" }] }, ["facebook"], true);
  expect(r[0].ok).toBe(false);
  expect(r[0].detail).toContain("video_aspect_ratio");
});
