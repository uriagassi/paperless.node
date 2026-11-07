import { Request, Response, NextFunction } from "express";
import { AgentKeys } from "./AgentKeys.js";

export interface IAuthHandler {
  clientData(): { handler: string };

  authorize(
    req: Request,
    res: Response,
    callback: (data: IUserData) => void
  ): void;
}

export interface IUserData {
  user_id: string;
  user_name: string;
  level?: "user" | "agent";
}

const BEARER = /^Bearer\s+(\S+)$/i;

export class Auth {
  private readonly authHandler: IAuthHandler;
  private readonly agentKeys: AgentKeys;
  constructor(
    authHandler: IAuthHandler,
    agentKeys: AgentKeys = AgentKeys.fromConfig([])
  ) {
    this.authHandler = authHandler;
    this.agentKeys = agentKeys;
  }

  auth(req: Request, res: Response, next: NextFunction) {
    if (req.path === "/auth") {
      return res.json(this.authHandler.clientData());
    }
    req.level = "user";
    const nonSecurePaths = [
      "/api/body/css",
      "/api/body/js",
      "/assets",
      "/manifest.json",
      "/favicon.ico"
    ];
    if (nonSecurePaths.find((p) => req.path.startsWith(p))) return next();
    if (req.path === "/") return next();

    const authorization = req.headers.authorization;
    if (authorization !== undefined && /^Bearer\b/i.test(authorization)) {
      const name = this.agentKeys.match(
        BEARER.exec(authorization)?.[1] ?? ""
      );
      if (name === undefined) {
        return res.status(401).send("Invalid Token");
      }
      req.user_id = `agent:${name}`;
      req.user_name = `agent:${name}`;
      req.level = "agent";
      return next();
    }

    if (req.cookies?.["x-token-user"] && req.path !== "/api/user") {
      req.user_name = req.cookies?.["x-token-user"];
      return next();
    }

    try {
      this.authHandler.authorize(req, res, (data) => {
        req.user_id = data.user_id;
        req.user_name = data.user_name;
        req.level = data.level ?? "user";
        res.cookie("x-token-user", data.user_name, {
          maxAge: 50000,
          secure: true,
          httpOnly: true,
          sameSite: "lax",
        });
        return next();
      });
    } catch (err) {
      console.log("Authorization failed:", err instanceof Error ? err.message : err);
      return res.status(401).send("Invalid Token");
    }
  }
}
