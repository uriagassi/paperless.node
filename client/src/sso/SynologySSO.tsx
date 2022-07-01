
export class SSO {
  access_token : string | null = null;
  constructor(params: {oauthserver_url: string,
    app_id: string,
    redirect_uri: string}) {
    console.log("starting Synology SSO")
    this.synology = params
    if (window.location.pathname == '/') {
      const queryParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
      console.log(queryParams)
      this.access_token = queryParams.get('access_token');
    }
  }

  login() : string {
    if (!this.access_token && window.location.pathname == '/') {
      window.location.href = `${this.synology.oauthserver_url}/webman/sso/SSOOauth.cgi?scope=user_id&redirect_uri=${this.synology.redirect_uri}&synossoJSSDK=false&app_id=${this.synology.app_id}`;
    }
    return this.access_token ?? ''
  }

  synology : {oauthserver_url: string,
    app_id: string,
    redirect_uri: string}

  authenticate(url: string) : string {
    return url + '?token=' + this.access_token
  }

  logout() : Promise<any> {
    return new Promise<any>(resolve => {
      const iframe = document.createElement('iframe')
      iframe.onload = () => resolve(null)
      iframe.src = `${this.synology.oauthserver_url}/webman/sso/SSOOauth.cgi?scope=user_id&redirect_uri=${this.synology.redirect_uri}&synossoJSSDK=false&app_id=${this.synology.app_id}&method=logout`;
      document.body.appendChild(iframe)
    })
  }

}
