import Cookies from "universal-cookie";
import { IAuth } from "./IAuth";

export class Auth implements IAuth {
  access_token_from_path: string | null = null;
  constructor(params: { login_href: string; logout_href: string }) {
    this.oauth_params = params;
    if (window.location.pathname == "/") {
      const queryParams = new URLSearchParams(window.location.hash.replace(/^#/, "?"));
      console.log(queryParams);
      this.access_token_from_path = queryParams.get("access_token");
    }
  }

  access_token(): string {
    if (!this.access_token_from_path && window.location.pathname == "/") {
      this.login();
    }
    console.log(this.access_token_from_path);
    return this.access_token_from_path ?? "";
  }

  login() {
    const cookies = new Cookies();
    const loggedInTheLastMinutes = cookies.get("loggenInTheLastMinute");
    if (loggedInTheLastMinutes) {
      console.log("throttling login");
    } else {
      cookies.set("loggenInTheLastMinute", true, { maxAge: 60 });
      window.location.href = this.oauth_params.login_href;
    }
  }

  oauth_params: { login_href: string; logout_href: string };

  logout(): Promise<unknown> {
    return new Promise<unknown>((resolve) => {
      const iframe = document.createElement("iframe");
      iframe.onload = () => resolve(null);
      iframe.src = this.oauth_params.logout_href;
      document.body.appendChild(iframe);
    });
  }
}
