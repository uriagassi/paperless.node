import { IAuthHandler, IUserData } from "./Auth";
import sanitizer from "string-sanitizer";
import https from "https";
import axios from "axios";
import { Request, Response } from "express";

export abstract class SimpleOAuth implements IAuthHandler {
  authorize(req: Request, res: Response, callback: (data: IUserData) => void) {
    const tok =
      req.query?.token ||
      req.body?.token ||
      req.query?.token ||
      req.headers["x-access-token"] ||
      req.cookies?.["x-access-token"];
    if (!tok) {
      return res
        .status(403)
        .send(
          "Not supported for unknown users or in Incognito Mode (no cookies)"
        );
    }
    const token = sanitizer.sanitize(tok);
    const agent = new https.Agent({
      rejectUnauthorized: this.shouldRejectUnauthorized(),
    });
    axios
      .get(this.oAuthUrl(token), { httpsAgent: agent })
      .then((res1) => {
        if (!res1.data.data) {
          console.log(res1.data);
          return res.status(401).send("Invalid Token");
        }
        res.cookie("x-access-token", token, {
          maxAge: 5000000,
          secure: true,
          httpOnly: true,
          sameSite: "lax",
        });
        callback(res1.data.data);
      })
      .catch((error) => {
        console.error(error);
        return res.status(401).send("Invalid Token");
      });
  }

  abstract clientData(): {
    handler: string;
    login_href: string;
    logout_href: string;
  };

  abstract oAuthUrl(token: string): string;

  shouldRejectUnauthorized(): boolean {
    return false;
  }
}
