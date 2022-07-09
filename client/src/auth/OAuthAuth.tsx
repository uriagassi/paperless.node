
export class Auth {
  access_token : string | null = null;
  constructor(params: {login_href: string, logout_href: string}) {
    this.oauth_params = params
    if (window.location.pathname == '/') {
      const queryParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
      console.log(queryParams)
      this.access_token = queryParams.get('access_token');
    }
  }

  login() : string {
    if (!this.access_token && window.location.pathname == '/') {
      window.location.href = this.oauth_params.login_href
    }
    return this.access_token ?? ''
  }

  oauth_params : {login_href: string, logout_href: string}

  authenticate(url: string) : string {
    return url + '?token=' + this.access_token
  }

  logout() : Promise<any> {
    return new Promise<any>(resolve => {
      const iframe = document.createElement('iframe')
      iframe.onload = () => resolve(null)
      iframe.src = this.oauth_params.logout_href
      document.body.appendChild(iframe)
    })
  }

}
