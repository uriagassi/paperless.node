export interface IAuth {
  access_token(): string;
  /** Like access_token(), but never triggers login() as a side effect. */
  available_token(): string | null;
  logout(): Promise<unknown>;
  login(): void;
}
