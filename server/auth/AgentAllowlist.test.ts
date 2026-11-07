import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { agentAllowlist } from "./AgentAllowlist.js";

function run(req: Partial<Request>) {
  const next = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  agentAllowlist(req as Request, res as unknown as Response, next);
  return { next, res };
}

describe("agentAllowlist", () => {
  it("lets users through", () => {
    expect(run({ level: "user", method: "POST", path: "/api/trash" }).next).toHaveBeenCalled();
  });

  it("lets agents through on allowlisted reads only", () => {
    expect(run({ level: "agent", method: "GET", path: "/api/tags" }).next).toHaveBeenCalled();
    const denied = run({ level: "agent", method: "GET", path: "/api/body/1" });
    expect(denied.next).not.toHaveBeenCalled();
    expect(denied.res.status).toHaveBeenCalledWith(403);
  });

  it("denies requests that Auth never classified", () => {
    const denied = run({ method: "GET", path: "/api/tags" });
    expect(denied.next).not.toHaveBeenCalled();
    expect(denied.res.status).toHaveBeenCalledWith(403);
  });
});
