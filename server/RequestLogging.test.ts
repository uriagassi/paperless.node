import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Console } from "console";
import fs from "fs";
import os from "os";
import path from "path";
import { Writable } from "stream";
import request from "supertest";
import Sqlite3 from "better-sqlite3";
import type { Express } from "express";

const AGENT_KEY = "agent-secret-key";

let app: Express;
let tmp: string;
let lines: string[] = [];

const output = new Writable({
  write(chunk, _enc, done) {
    // a multi-line message is stamped once, on its first line
    for (const line of chunk.toString().split("\n").filter(Boolean)) {
      if (/^\[\d/.test(line) || lines.length === 0) lines.push(line);
      else lines[lines.length - 1] += `\n${line}`;
    }
    done();
  },
});

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "paperless-log-test-"));
  const baseDir = path.join(tmp, "base");
  fs.cpSync("template", baseDir, { recursive: true });
  fs.mkdirSync(path.join(tmp, "import"));
  fs.writeFileSync(path.join(tmp, "credentials.json"), "{}");
  new Sqlite3(path.join(baseDir, "paperless.sqlite")).close();

  process.env.NODE_CONFIG = JSON.stringify({
    paperless: { baseDir, importDir: path.join(tmp, "import") },
    auth: { agentKeys: [{ name: "alice", key: AGENT_KEY }] },
    mail: { credentials: path.join(tmp, "credentials.json") },
  });
  const { installLogging } = await import("./Logging.js");
  // vitest's console has no Console constructor, which console-stamp needs
  (console as { Console?: unknown }).Console ??= Console;
  const stamped = new Console(output);
  installLogging(stamped, output);
  vi.spyOn(console, "log").mockImplementation((...a) => stamped.log(...a));
  ({ app } = await import("./app.js"));
});

beforeEach(() => {
  lines = [];
});

afterAll(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows keeps the sqlite file locked until the process exits
  }
});

describe("role labels", () => {
  it("labels SQL lines logged during a user request", async () => {
    await request(app).get("/api/tags");
    const sql = lines.filter((l) => /select/i.test(l));
    expect(sql.length).toBeGreaterThan(0);
    for (const l of sql) expect(l).toContain("[user:You]");
  });
});

describe("role labels for agents", () => {
  it("labels SQL lines logged during an agent request", async () => {
    await request(app).get("/api/tags").set("Authorization", `Bearer ${AGENT_KEY}`);
    const sql = lines.filter((l) => /select/i.test(l));
    expect(sql.length).toBeGreaterThan(0);
    for (const l of sql) expect(l).toContain("[agent:alice]");
  });
});

describe("per-request line", () => {
  const requestLine = (re: RegExp) => lines.filter((l) => re.test(l));

  it("records method, path, status and duration with the role label", async () => {
    await request(app).get("/api/tags").set("Authorization", `Bearer ${AGENT_KEY}`);
    expect(requestLine(/GET \/api\/tags 200 \d+ms$/)).toHaveLength(1);
    expect(requestLine(/GET \/api\/tags 200 \d+ms$/)[0]).toContain("[agent:alice]");
  });

  it("records requests denied by the agent allowlist", async () => {
    await request(app).post("/api/tags").set("Authorization", `Bearer ${AGENT_KEY}`);
    const l = requestLine(/POST \/api\/tags 403 \d+ms$/);
    expect(l).toHaveLength(1);
    expect(l[0]).toContain("[agent:alice]");
  });

  it("records requests rejected by auth, without a label", async () => {
    await request(app).get("/api/tags").set("Authorization", "Bearer wrong");
    const l = requestLine(/GET \/api\/tags 401 \d+ms$/);
    expect(l).toHaveLength(1);
    expect(l[0]).not.toMatch(/\[(agent|user):/);
  });
});

describe("quiet polling route", () => {
  const statusLines = () => lines.filter((l) => /\/api\/files\/checkStatus/.test(l));

  it("does not log successful checkStatus polls", async () => {
    await request(app).get("/api/files/checkStatus");
    expect(statusLines()).toEqual([]);
  });

  it("still logs checkStatus requests denied by the agent allowlist", async () => {
    await request(app).get("/api/files/checkStatus").set("Authorization", `Bearer ${AGENT_KEY}`);
    expect(statusLines().some((l) => /403 \d+ms$/.test(l))).toBe(true);
  });

  it("still logs checkStatus requests rejected by auth", async () => {
    await request(app).get("/api/files/checkStatus").set("Authorization", "Bearer wrong");
    expect(statusLines().some((l) => /401 \d+ms$/.test(l))).toBe(true);
  });

  it("still logs other successful api requests", async () => {
    await request(app).get("/api/tags");
    expect(lines.some((l) => /GET \/api\/tags 200 \d+ms$/.test(l))).toBe(true);
  });
});

describe("redaction", () => {
  const everything = () => lines.join("\n");

  it("never logs ?token query values or the agent key", async () => {
    await request(app)
      .get("/api/tags?token=QUERY-SECRET")
      .set("Authorization", `Bearer ${AGENT_KEY}`);
    await request(app).get("/api/tags?token=QUERY-SECRET");
    await request(app)
      .get("/api/tags?token=QUERY-SECRET")
      .set("Authorization", "Bearer rejected-key");
    expect(lines.length).toBeGreaterThan(0);
    expect(everything()).not.toContain("QUERY-SECRET");
    expect(everything()).not.toContain(AGENT_KEY);
    expect(everything()).not.toContain("rejected-key");
  });

  it("logs cookie names but not values when logging out", async () => {
    await request(app).get("/api/logout").set("Cookie", "x-access-token=COOKIE-SECRET");
    expect(everything()).toContain("clearing cookie x-access-token");
    expect(everything()).not.toContain("COOKIE-SECRET");
  });
});
