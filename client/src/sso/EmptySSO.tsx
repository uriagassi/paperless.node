export class SSO {
  access_token : string | null = 'none';


  login() : string {
    return this.access_token ?? ''
  }

  authenticate(url: string) : string {
    return url
  }

  logout() : Promise<any> {
    return new Promise<any>((r) => r(null))
  }
}
