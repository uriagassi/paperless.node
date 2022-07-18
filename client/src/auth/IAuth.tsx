export interface IAuth {
  access_token(): string;
  logout(): Promise<unknown>;
  login(): void;
}
