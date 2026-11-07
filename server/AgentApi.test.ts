import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import type { Express } from "express";
import { AGENT_ROUTES } from "./auth/AgentAllowlist.js";

let tmp: string;
let baseConfig: object;
let app: Express;
let baseUrl: typeof import("./AgentApi.js").baseUrl;


beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "paperless-agentapi-"));
  const baseDir = path.join(tmp, "base");
  fs.cpSync("template", baseDir, { recursive: true });
  fs.mkdirSync(path.join(tmp, "import"));
  baseConfig = { paperless: { baseDir, importDir: path.join(tmp, "import") } };
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  process.env.NODE_CONFIG = JSON.stringify(baseConfig);
  app = (await import("./app.js")).app;
  ({ baseUrl } = await import("./AgentApi.js"));
});

afterAll(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows keeps the sqlite file locked until the process exits
  }
});

describe("GET /agent-api", () => {
  it("serves HTML without auth", async () => {
    const res = await request(app).get("/agent-api").set("Host", "notes.example.com");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.headers.vary).toMatch(/Accept/i);
    expect(res.text).toContain("<h1");
    expect(res.text).toContain("http://notes.example.com/api/search");
  });

  it.each([
    ["Accept header", (r: request.Test) => r.set("Accept", "text/markdown")],
    ["browser-style Accept", (r: request.Test) => r.set("Accept", "text/html")],
  ])("negotiates Markdown vs HTML with %s", async (label, set) => {
    const res = await set(request(app).get("/agent-api"));
    const isMarkdown = label === "Accept header";
    expect(res.headers["content-type"]).toMatch(
      isMarkdown ? /text\/markdown/ : /text\/html/
    );
  });

  it("serves raw Markdown at /agent-api.md", async () => {
    const res = await request(app).get("/agent-api.md");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/markdown/);
    expect(res.text).toMatch(/^# paperless.node Agent API/);
  });

  it("fills {BASE_URL} from the request origin", async () => {
    const res = await request(app).get("/agent-api.md").set("Host", "localhost:3000");
    expect(res.text).toContain("http://localhost:3000/api/search");
    expect(res.text).not.toContain("{BASE_URL}");
  });

  it("honors X-Forwarded-* from a trusted proxy", async () => {
    const res = await request(app)
      .get("/agent-api.md")
      .set("X-Forwarded-Proto", "https")
      .set("X-Forwarded-Host", "notes.example.com");
    expect(res.text).toContain("https://notes.example.com/api/search");
  });

  it("does not let a hostile Host header inject markup", async () => {
    const res = await request(app).get("/agent-api").set("Host", "<script>x</script>");
    expect(res.text).not.toContain("<script>x");
    expect(res.text).not.toContain("{BASE_URL}");
  });

  it("falls back to bare paths without a usable host", async () => {
    const res = await request(app).get("/agent-api.md").set("Host", "");
    expect(res.text).not.toContain("{BASE_URL}");
    expect(res.text).toContain("GET /api/search");
  });

  it("prefers publicBaseUrl over the request origin", () => {
    const req = { protocol: "http", host: "internal:3000" };
    expect(baseUrl(req, "https://paper.example.org/")).toBe("https://paper.example.org");
    expect(baseUrl(req, "not a url")).toBe("http://internal:3000");
    expect(baseUrl(req, "ftp://paper.example.org")).toBe("http://internal:3000");
    expect(baseUrl(req, undefined)).toBe("http://internal:3000");
  });

  it("does not make other paths public", async () => {
    const res = await request(app).get("/agent-api/extra");
    expect(res.status).not.toBe(200);
    expect((await request(app).get("/api/user")).status).toBe(200);
  });
});

describe("docs/agent-api.md coverage", () => {
  const doc = fs.readFileSync("docs/agent-api.md", "utf-8");
  const documented = new Set(
    [...doc.matchAll(/^\| (GET|POST|DELETE) \| `([^`]+)` \|/gm)].map(
      (m) => `${m[1]} ${m[2]}`
    )
  );
  const toDocPath = (p: string) =>
    p.replace(/^\/api\/tags\/\[\^\/\]\+$/, "/api/tags/:id")
      .replace("/api/notebooks/[^/]+", "/api/notebooks/:id")
      .replace("/api/notes/[^/]+/tags/[^/]+", "/api/notes/:id/tags/:tagId")
      .replace("/api/notes/[^/]+", "/api/notes/:id");

  const allowed = Object.entries(AGENT_ROUTES).flatMap(([method, paths]) =>
    paths.map((p) => `${method} ${toDocPath(p)}`)
  );

  it.each(allowed)("documents %s", (route) => {
    expect(documented).toContain(route);
  });

  it("documents nothing the allowlist does not permit", () => {
    expect([...documented].sort()).toEqual([...allowed].sort());
  });
});
