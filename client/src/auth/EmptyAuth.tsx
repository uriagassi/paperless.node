export class Auth {
  access_token: string | null = "none";

  login(): string {
    return this.access_token ?? "";
  }

  forceLogin(): void {
    throw "Unsupported Method";
  }

  authenticate(url: string): string {
    return url;
  }

  logout(): Promise<unknown> {
    return new Promise<unknown>((r) => r(null));
  }
}
