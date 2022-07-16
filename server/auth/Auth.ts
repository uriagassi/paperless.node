import { Request, Response, NextFunction } from "express";

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
}

export class Auth {
  private readonly authHandler: IAuthHandler;
  constructor(authHandler: IAuthHandler) {
    this.authHandler = authHandler;
  }

  auth(req: Request, res: Response, next: NextFunction) {
    if (req.path === "/auth") {
      return res.json(this.authHandler.clientData());
    }
    const nonSecurePaths = ["/api/body/css", "/api/body/js", "/static", "/manifest.json"];
    if (nonSecurePaths.find((p) => req.path.startsWith(p))) return next();
    if (req.path === "/") return next();

    if (req.cookies?.["x-token-user"] && req.path !== "/api/user") {
      req.user_name = req.cookies?.["x-token-user"];
      return next();
    }

    try {
      this.authHandler.authorize(req, res, (data) => {
        req.user_id = data.user_id;
        req.user_name = data.user_name;
        res.cookie("x-token-user", data.user_name, {
          maxAge: 50000,
          secure: true,
          httpOnly: true,
          sameSite: "lax",
        });
        return next();
      });
    } catch (err) {
      console.log(err);
      return res.status(401).send("Invalid Token");
    }
  }
}
