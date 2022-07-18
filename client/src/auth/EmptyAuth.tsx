import { IAuth } from "./IAuth";

export class Auth implements IAuth {
  access_token(): string {
    return "none";
  }

  login(): void {
    throw "Unsupported Method";
  }

  logout(): Promise<unknown> {
    return new Promise<unknown>((r) => r(null));
  }
}
