import { afterEach, describe, expect, it, vi } from "vitest";
import { format } from "util";
import type { Request, Response } from "express";
import { SimpleOAuth } from "./SimpleOAuth.js";

class UnreachableOAuth extends SimpleOAuth {
  clientData() {
    return { handler: "test", login_href: "", logout_href: "" };
  }
  oAuthUrl(token: string) {
    return `https://127.0.0.1:1/exchange?action=exchange&access_token=${token}`;
  }
}

afterEach(() => vi.restoreAllMocks());

describe("SimpleOAuth failed token exchange", () => {
  it("rejects with 401 without writing the token to the logs", async () => {
    const logged: string[] = [];
    const record = (...a: unknown[]) => {
      logged.push(format(...a));
    };
    vi.spyOn(console, "error").mockImplementation(record);
    vi.spyOn(console, "log").mockImplementation(record);

    const req = { query: { token: "QUERYSECRET" }, headers: {}, cookies: {} } as unknown as Request;
    const status = await new Promise<number>((resolve) => {
      const res = {
        status: (s: number) => ({ send: () => resolve(s) }),
      } as unknown as Response;
      new UnreachableOAuth().authorize(req, res, () => undefined);
    });

    expect(status).toBe(401);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.join("\n")).not.toContain("QUERYSECRET");
  });
});
