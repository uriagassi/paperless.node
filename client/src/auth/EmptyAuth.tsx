import { IAuth } from "./IAuth";

export class Auth implements IAuth {
  access_token(): string {
    return "none";
  }

  available_token(): string | null {
    return null;
  }

  login(): void {
    throw "Unsupported Method";
  }

  logout(): Promise<unknown> {
    return new Promise<unknown>((r) => r(null));
  }
}
