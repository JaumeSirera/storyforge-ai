import { expect, test } from "bun:test";
import { publishSocial } from "./social-publish.server";
import { signRelayBody, verifyRelayBody } from "./linkedin.server";

function withEnv(vars, fn) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test("LinkedIn publishes with its own connection and never through Upload-Post", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/linkedin/v2/userinfo")) return Response.json({ sub: "abc" });
    if (String(url).endsWith("/linkedin/v2/ugcPosts")) return Response.json({ id: "urn:li:share:1" });
    throw new Error("unexpected " + url);
  };
  try {
    await withEnv({ LOVABLE_API_KEY: "l", LINKEDIN_API_KEY: "k" }, async () => {
      // Sin clave de Upload-Post: LinkedIn debe publicarse igualmente.
      const r = await publishSocial({ key: null, profile: "" }, { body: "Hola LinkedIn", links: [], media: [] }, ["linkedin"]);
      expect(r).toHaveLength(1);
      expect(r[0].platform).toBe("linkedin");
      expect(r[0].ok).toBe(true);
    });
    expect(calls.some((u) => u.includes("upload-post.com"))).toBe(false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Other networks still go to Upload-Post without LinkedIn in the request", async () => {
  const originalFetch = globalThis.fetch;
  let platforms = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/linkedin/v2/userinfo")) return Response.json({ sub: "abc" });
    if (String(url).endsWith("/linkedin/v2/ugcPosts")) return Response.json({ id: "urn:li:share:2" });
    if (String(url).endsWith("/uploadposts/users")) return Response.json({ profiles: [{ username: "p" }] });
    if (String(url).endsWith("/upload_text")) { platforms = init.body.getAll("platform[]"); return Response.json({ success: true }); }
    throw new Error("unexpected " + url);
  };
  try {
    await withEnv({ LOVABLE_API_KEY: "l", LINKEDIN_API_KEY: "k" }, () =>
      publishSocial({ key: "k", profile: "p" }, { body: "Texto", links: [], media: [] }, ["linkedin", "x"]));
    expect(platforms).toEqual(["x"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Own hosting without the connection forwards a signed request", async () => {
  const originalFetch = globalThis.fetch;
  let forwarded;
  globalThis.fetch = async (url, init) => {
    forwarded = { url: String(url), sig: init.headers["X-Relay-Signature"], raw: init.body };
    return Response.json({ ok: true, detail: "https://www.linkedin.com/feed/update/urn:li:share:3/" });
  };
  try {
    await withEnv({ LOVABLE_API_KEY: undefined, LINKEDIN_API_KEY: undefined, EXTERNAL_API_TOKEN: "secreto" }, async () => {
      const r = await publishSocial({ key: null, profile: "" }, { body: "Desde mi hosting", links: [], media: [] }, ["linkedin"]);
      expect(r[0].ok).toBe(true);
      expect(forwarded.url).toBe("https://iworkpre.lovable.app/api/public/social/linkedin-relay");
      expect(await verifyRelayBody(forwarded.raw, forwarded.sig)).not.toBeNull();
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("Forwarded requests with a wrong signature or older than 5 minutes are rejected", async () => {
  await withEnv({ EXTERNAL_API_TOKEN: "secreto" }, async () => {
    const raw = JSON.stringify({ ts: Date.now(), text: "x", media: [] });
    expect(await verifyRelayBody(raw, "mala")).toBeNull();
    const old = JSON.stringify({ ts: Date.now() - 6 * 60_000, text: "x", media: [] });
    expect(await verifyRelayBody(old, await signRelayBody(old))).toBeNull();
  });
});
