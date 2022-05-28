export interface ISSO {
  access_token : string | null,
  login() : string,
  authenticate(url: string) : string
}
