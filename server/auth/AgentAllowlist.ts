import { Request, Response, NextFunction } from "express";

const ID = "[^/]+";
const compile = (paths: string[]) =>
  paths.map((p) => new RegExp(`^${p}/?$`, "i"));

export const AGENT_ROUTES: Record<"GET" | "POST" | "DELETE", string[]> = {
  GET: [
    "/api/search",
    "/api/tags",
    "/api/notebooks",
    "/api/notebooks_and_tags",
    "/api/user",
    `/api/tags/${ID}`,
    `/api/notebooks/${ID}`,
    `/api/notes/${ID}`,
  ],
  POST: [`/api/agent/tags`, `/api/notes/${ID}/addTag`],
  DELETE: [`/api/notes/${ID}/tags/${ID}`],
};

const READ_ROUTES = compile(AGENT_ROUTES.GET);

const TAG_WRITE_MATCHERS: Record<string, RegExp[]> = {
  POST: compile(AGENT_ROUTES.POST),
  DELETE: compile(AGENT_ROUTES.DELETE),
};

export function isAgentAllowed(method: string, path: string): boolean {
  if (method === "GET" || method === "HEAD") {
    return READ_ROUTES.some((r) => r.test(path));
  }
  return (TAG_WRITE_MATCHERS[method] ?? []).some((r) => r.test(path));
}

export function agentAllowlist(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (
    req.level === "user" ||
    (req.level === "agent" && isAgentAllowed(req.method, req.path))
  ) {
    return next();
  }
  return res.status(403).send("Not available to agents");
}
