import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { Auth } from "./Auth.js";

const authorize = vi.fn();

function appWithAuth() {
  const app = express();
  app.use(cookieParser("test-secret"));
  const auth = new Auth({
    clientData: () => ({ handler: "test" }),
    authorize: (req, res, callback) => {
      authorize();
      if (req.query.sso === "ok") callback({ user_id: "1", user_name: "bob" });
      else res.status(401).send("Invalid Token");
    },
  });
  app.use((req, res, next) => auth.auth(req, res, next));
  app.get("/api/tags", (req, res) => res.json({ user: req.user_name }));
  return app;
}

async function signedSessionCookie(app: express.Express) {
  const res = await request(app).get("/api/tags?sso=ok");
  const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
    c.startsWith("x-token-user=")
  );
  return cookie!.split(";")[0];
}

afterEach(() => {
  authorize.mockClear();
  vi.restoreAllMocks();
});

describe("x-token-user cookie", () => {
  it("is issued signed, httpOnly and secure", async () => {
    const res = await request(appWithAuth()).get("/api/tags?sso=ok");
    const cookie = (res.headers["set-cookie"] as unknown as string[])[0];
    expect(decodeURIComponent(cookie)).toMatch(/^x-token-user=s:/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
  });

  it("is accepted without asking SSO again while valid", async () => {
    const app = appWithAuth();
    const cookie = await signedSessionCookie(app);
    authorize.mockClear();
    const res = await request(app).get("/api/tags").set("Cookie", cookie);
    expect(res.body.user).toBe("bob");
    expect(authorize).not.toHaveBeenCalled();
  });

  it("is not trusted when merely present", async () => {
    const res = await request(appWithAuth())
      .get("/api/tags")
      .set("Cookie", "x-token-user=mallory");
    expect(res.status).toBe(401);
  });

  it("is rejected when the signature is tampered with", async () => {
    const app = appWithAuth();
    const cookie = decodeURIComponent(await signedSessionCookie(app));
    const tampered = cookie.replace("|bob", "|root");
    const res = await request(app)
      .get("/api/tags")
      .set("Cookie", encodeURIComponent(tampered).replace("x-token-user%3D", "x-token-user="));
    expect(res.status).toBe(401);
  });

  it("is rejected after it expires, even if replayed", async () => {
    const app = appWithAuth();
    const cookie = await signedSessionCookie(app);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 60_000);
    const res = await request(app).get("/api/tags").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("is ignored for agent requests", async () => {
    const app = appWithAuth();
    const cookie = await signedSessionCookie(app);
    const res = await request(app)
      .get("/api/tags")
      .set("Cookie", cookie)
      .set("Authorization", "Bearer unknown");
    expect(res.status).toBe(401);
  });
});
