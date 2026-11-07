import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { Auth } from "./Auth.js";

function run(req: Partial<Request>) {
  const authorize = vi.fn();
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn(), cookie: vi.fn() };
  const request = {
    headers: {},
    path: "/api/tags",
    cookies: {},
    signedCookies: {},
    ...req,
  } as Request;
  new Auth({ clientData: () => ({ handler: "x" }), authorize }).auth(
    request,
    res as unknown as Response,
    next
  );
  return { authorize, next, res, request };
}

describe("x-token-user cookie", () => {
  it("is not trusted when merely present (unsigned or tampered)", () => {
    const { authorize, next } = run({
      cookies: { "x-token-user": "mallory" },
      signedCookies: { "x-token-user": false as unknown as string },
    });
    expect(next).not.toHaveBeenCalled();
    expect(authorize).toHaveBeenCalled();
  });

  it("is trusted when its signature verified", () => {
    const { authorize, next, request } = run({
      signedCookies: { "x-token-user": "bob" },
    });
    expect(next).toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
    expect(request.user_name).toBe("bob");
  });

  it("is issued signed", () => {
    const { authorize, res } = run({});
    authorize.mock.calls[0][2]({ user_id: "1", user_name: "bob" });
    expect(res.cookie).toHaveBeenCalledWith(
      "x-token-user",
      "bob",
      expect.objectContaining({ signed: true, httpOnly: true })
    );
  });
});
