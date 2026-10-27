import { expect, test } from "bun:test";
import { publishSocial, checkSocialPublication, summarize } from "./social-publish.server";

test("Facebook submission is tracked and checked without a second upload", async () => {
  const originalFetch = globalThis.fetch;
  let uploads = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/uploadposts/users")) return Response.json({ profiles: [{ username: "test-profile" }] });
    if (String(url).endsWith("/upload_text")) {
      uploads++;
      expect(init.body.get("async_upload")).toBe("true");
      expect(init.body.get("request_id")).toBeTruthy();
      return Response.json({ success: true, request_id: "fb-job-1" });
    }
    expect(String(url)).toBe("https://api.upload-post.com/api/uploadposts/status?request_id=fb-job-1");
    return Response.json({ status: "completed", results: [{ platform: "facebook", success: true, message: "Published", post_url: "https://www.facebook.com/posts/123" }] });
  };
  try {
    const creds = { key: "test-not-a-real-key", profile: "test-profile" };
    const submitted = await publishSocial(creds, { body: "Un capítulo para Facebook", links: [], media: [] }, ["facebook"]);
    expect(summarize(submitted).status).toBe("enviando");
    const checked = await checkSocialPublication(creds, submitted);
    expect(summarize(checked).status).toBe("publicado");
    expect(checked[0].detail).toBe("https://www.facebook.com/posts/123");
    expect(uploads).toBe(1);
  } finally { globalThis.fetch = originalFetch; }
});