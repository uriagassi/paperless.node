import { IAuthHandler, IUserData } from "./Auth.js";
import e from "express";

export class AuthHandler implements IAuthHandler {
  clientData() {
    return { handler: "EmptyAuth" };
  }

  authorize(
    req: e.Request,
    res: e.Response,
    callback: (data: IUserData) => void
  ): void {
    callback({ user_id: "1", user_name: "You" });
  }
}
