import { Request, Response, NextFunction } from "express";

const ID = "[^/]+";
const READ_ROUTES = [
  "/api/search",
  "/api/tags",
  "/api/notebooks",
  "/api/notebooks_and_tags",
  "/api/user",
  `/api/tags/${ID}`,
  `/api/notebooks/${ID}`,
  `/api/notes/${ID}`,
].map((p) => new RegExp(`^${p}/?$`, "i"));

export function isAgentAllowed(method: string, path: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return READ_ROUTES.some((r) => r.test(path));
}

export function agentAllowlist(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.level !== "agent" || isAgentAllowed(req.method, req.path)) {
    return next();
  }
  return res.status(403).send("Not available to agents");
}
