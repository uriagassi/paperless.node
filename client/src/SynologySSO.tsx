import {useEffect} from "react";

export class SynologySSO {
  access_token : string | null = null;
  constructor() {
    const queryParams = new URLSearchParams(window.location.hash.replace(/^#/, '?'));
    console.log(queryParams)
    this.access_token = queryParams.get('access_token');
  }

  login() : string {
    if (!this.access_token) {
      window.location.href = `${this.synology.oauthserver_url}/webman/sso/SSOOauth.cgi?scope=user_id&redirect_uri=${this.synology.redirect_uri}&synossoJSSDK=false&app_id=${this.synology.app_id}`;
    }
    return this.access_token ?? ''
  }

  synology = {oauthserver_url: process.env.REACT_APP_SYNOLOGY_DOMAIN,
    app_id: process.env.REACT_APP_SYNOLOGY_APP_ID,
    redirect_uri: process.env.REACT_APP_SYNOLOGY_REDIRECT_URI}

  authenticate(url: string) : string {
    return url + '?token=' + this.access_token
  }

}
