import { AsyncLocalStorage } from "async_hooks";
import consoleStamp from "console-stamp";
import { NextFunction, Request, Response } from "express";

const requestRole = new AsyncLocalStorage<string>();

export function roleLabel(req: Request): string | undefined {
  if (!req.user_name) return undefined;
  const name = req.user_name.replace(/[\s[\]\p{Cc}]+/gu, "_");
  return req.level === "agent"
    ? `agent:${name.replace(/^agent:/, "")}`
    : `user:${name}`;
}

export function runWithRole(req: Request, res: Response, next: NextFunction) {
  const label = roleLabel(req);
  return label ? requestRole.run(label, next) : next();
}

export function logRequests(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) return next();
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    const line = `${req.method} ${req.path} ${res.statusCode} ${ms}ms`;
    const label = roleLabel(req);
    if (label) requestRole.run(label, () => console.log(line));
    else console.log(line);
  });
  next();
}

export function installLogging(
  target: Console,
  stdout?: NodeJS.WritableStream
) {
  consoleStamp(target, {
    ...(stdout ? { stdout } : {}),
    tokens: {
      label: ({ defaultTokens, method, params }) => {
        const base = defaultTokens.label({ method, params } as never);
        const role = requestRole.getStore();
        return role ? `${base} [${role}]` : base;
      },
    },
  });
}
