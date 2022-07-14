export interface IAuth {
  access_token: string | null;
  login(): string;
  authenticate(url: string): string;
  logout(): Promise<unknown>;
}
