import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import Sqlite3 from "better-sqlite3";
import type { Express, Request, Response } from "express";

const AGENT_KEY = "agent-secret-key";
const HASHED_KEY = "hashed-agent-secret-key";

let app: Express;
let csrfProtection: (req: Request, res: Response, next: () => void) => void;
let tmp: string;

const agent = (r: request.Test) => r.set("Authorization", `Bearer ${AGENT_KEY}`);

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "paperless-test-"));
  const baseDir = path.join(tmp, "base");
  fs.cpSync("template", baseDir, { recursive: true });
  fs.mkdirSync(path.join(tmp, "import"));
  fs.writeFileSync(path.join(tmp, "credentials.json"), "{}");

  const seed = new Sqlite3(path.join(baseDir, "paperless.sqlite"));
  seed.exec(`
    insert into Notes (noteId, notebookId, createTime, updateTime, title, noteData)
      values (1, 2, '2024-01-01', '2024-01-01', 'Tax return', '<p>secret body</p>');
    insert into Attachments (noteId, fileName, uniqueFileName, mime, size)
      values (1, 'tax-2023-john-doe.pdf', 'tax-2023-john-doe-1.pdf', 'application/pdf', 10);
    insert into Tags (tagId, name, isExpanded) values (1, 'taxes', 0);
    insert into NoteTags (noteId, tagId) values (1, 1);
  `);
  seed.close();

  process.env.NODE_CONFIG = JSON.stringify({
    paperless: { baseDir, importDir: path.join(tmp, "import") },
    auth: {
      agentKeys: [
        { name: "alice", key: AGENT_KEY },
        { name: "bob", keyHash: (await import("./auth/AgentKeys.js")).AgentKeys.hash(HASHED_KEY) },
      ],
    },
    mail: { credentials: path.join(tmp, "credentials.json") },
  });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  ({ app, csrfProtection } = await import("./app.js"));
});

afterAll(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // Windows keeps the sqlite file locked until the process exits
  }
});

describe("authentication", () => {
  it("authenticates a valid agent key as agent:<name>", async () => {
    const res = await agent(request(app).get("/api/user"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user_id: "agent:alice",
      user_name: "agent:alice",
      level: "agent",
    });
  });

  it("authenticates a hashed agent key", async () => {
    const res = await request(app)
      .get("/api/user")
      .set("Authorization", `Bearer ${HASHED_KEY}`);
    expect(res.body.user_name).toBe("agent:bob");
  });

  it("rejects an invalid agent key", async () => {
    const res = await request(app)
      .get("/api/tags")
      .set("Authorization", "Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("does not fall back to cookie auth when the key is invalid", async () => {
    const res = await request(app)
      .get("/api/tags")
      .set("Authorization", "Bearer wrong")
      .set("Cookie", "x-token-user=You");
    expect(res.status).toBe(401);
  });

  it("leaves user auth unchanged, with level user", async () => {
    const res = await request(app).get("/api/user");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ user_name: "You", level: "user" });
  });

  it("never sets auth cookies for agents", async () => {
    const res = await agent(request(app).get("/api/tags"));
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("ignores auth cookies on agent requests", async () => {
    const res = await agent(request(app).get("/api/user")).set(
      "Cookie",
      "x-token-user=You; x-access-token=whatever"
    );
    expect(res.body.user_name).toBe("agent:alice");
  });

  it("ignores a non-bearer Authorization header", async () => {
    const res = await request(app)
      .get("/api/user")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.body.level).toBe("user");
  });
});

describe("allowlisted read routes for agents", () => {
  it.each([
    "/api/tags",
    "/api/notebooks",
    "/api/notebooks_and_tags",
    "/api/user",
    "/api/tags/1?lastItem=2000-01-01&limit=10",
    "/api/notebooks/2?lastItem=2000-01-01&limit=10",
    "/api/search?term=tax&lastItem=2000-01-01&limit=10",
    "/api/notes/1",
  ])("GET %s works", async (route) => {
    const res = await agent(request(app).get(route));
    expect(res.status).toBe(200);
  });

  it("hides attachment file names in note listings", async () => {
    for (const route of [
      "/api/notebooks/2?lastItem=2000-01-01&limit=10",
      "/api/tags/1?lastItem=2000-01-01&limit=10",
      "/api/search?term=tax&lastItem=2000-01-01&limit=10",
    ]) {
      const res = await agent(request(app).get(route));
      expect(res.body.notes).toHaveLength(1);
      expect(res.body.notes[0]).not.toHaveProperty("attachments");
      expect(res.body.notes[0]).toMatchObject({
        title: "Tax return",
        mime: "application/pdf",
        attachmentCount: 1,
      });
      expect(JSON.stringify(res.body)).not.toContain("john-doe");
    }
  });

  it("hides attachment file names in note metadata", async () => {
    const res = await agent(request(app).get("/api/notes/1"));
    expect(res.body.attachments).toEqual([{ id: 1 }]);
    expect(JSON.stringify(res.body)).not.toContain("john-doe");
  });

  it("keeps file names for users", async () => {
    const res = await request(app).get("/api/notes/1");
    expect(res.body.attachments[0]).toMatchObject({
      fileName: "tax-2023-john-doe.pdf",
      uniqueFileName: "tax-2023-john-doe-1.pdf",
    });
    const list = await request(app).get(
      "/api/notebooks/2?lastItem=2000-01-01&limit=10"
    );
    expect(list.body.notes[0].attachments).toBe("tax-2023-john-doe.pdf");
  });
});

describe("default-deny for agents", () => {
  const denied: [string, string, string][] = [
    ["note body", "get", "/api/body/1"],
    ["note body attachments", "get", "/api/body/attachments/tax-2023-john-doe-1.pdf"],
    ["body images", "get", "/api/body/images/pdf-icon-48x48.png"],
    ["attachment listing", "get", "/api/notes/1/attachments"],
    ["note update", "post", "/api/notes/1"],
    ["note split", "post", "/api/notes/1/split"],
    ["note move", "post", "/api/notes/1/notebook/1"],
    ["add tag to note", "post", "/api/notes/1/addTag"],
    ["remove tag from note", "delete", "/api/notes/1/tags/1"],
    ["new notebook", "post", "/api/notebooks/foo"],
    ["delete notebook", "delete", "/api/notebooks/1"],
    ["new tag (put)", "put", "/api/tags/new"],
    ["update tag", "post", "/api/tags/1"],
    ["expand tag", "post", "/api/tags/1/expand"],
    ["delete tag", "delete", "/api/tags/1"],
    ["mail auth", "get", "/api/mail/auth"],
    ["mail pending", "get", "/api/mail/pending"],
    ["mail import", "post", "/api/mail/import"],
    ["import check", "get", "/api/files/checkStatus"],
    ["import run", "get", "/api/files/import"],
    ["upload new note", "post", "/api/files/new"],
    ["merge notes", "post", "/api/notes/1/merge"],
    ["delete note (trash)", "delete", "/api/notes/1"],
    ["empty trash", "delete", "/api/trash"],
    ["csrf token", "get", "/csrf"],
    ["logout", "get", "/api/logout"],
  ];

  it.each(denied)("%s: %s %s returns 403", async (_label, method, route) => {
    const res = await agent(
      (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](route)
    );
    expect(res.status).toBe(403);
  });

  it.each([
    ["case variants", "get", "/API/body/1"],
    ["trailing segments", "get", "/api/notes/1/extra"],
    ["HEAD on denied", "head", "/api/body/1"],
  ])("cannot be bypassed via %s", async (_label, method, route) => {
    const res = await agent(
      (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](route)
    );
    expect(res.status).toBe(403);
  });

  it("still lets the same routes through for users", async () => {
    const res = await request(app).get("/api/body/1");
    expect(res.status).toBe(200);
    expect(res.text).toContain("secret body");
  });
});

describe("CSRF", () => {
  it("is still enforced for user mutations", async () => {
    const res = await request(app).post("/api/notebooks/foo");
    expect(res.status).toBe(403);
    expect(res.text).toMatch(/csrf/i);
  });

  it("is skipped for agent requests", () => {
    const next = vi.fn();
    csrfProtection({ level: "agent" } as Request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
