import { SimpleOAuth } from "./SimpleOAuth.js";
import config from "config";

export class AuthHandler extends SimpleOAuth {
  clientData(): { handler: string; login_href: string; logout_href: string } {
    return {
      handler: "OAuthAuth",
      login_href: `https://${config.get("synology.hostname")}:${config.get(
        "synology.port"
      )}/webman/sso/SSOOauth.cgi?scope=user_id&redirect_uri=${config.get(
        "synology.redirect_uri"
      )}&synossoJSSDK=false&app_id=${config.get("synology.appId")}`,
      logout_href: `https://${config.get("synology.hostname")}:${config.get(
        "synology.port"
      )}/webman/sso/SSOOauth.cgi?scope=user_id&redirect_uri=${config.get(
        "synology.redirect_uri"
      )}&synossoJSSDK=false&app_id=${config.get(
        "synology.appId"
      )}&method=logout`,
    };
  }

  private serverSideHostname(): string {
    return config.has("synology.internalHostname")
      ? config.get("synology.internalHostname")
      : config.get("synology.hostname");
  }

  oAuthUrl(token: string): string {
    return `https://${this.serverSideHostname()}:${config.get(
      "synology.port"
    )}/webman/sso/SSOAccessToken.cgi?action=exchange&app_id=${config.get(
      "synology.appId"
    )}&access_token=${token}`;
  }

  shouldRejectUnauthorized(): boolean {
    if (config.has("synology.internalHostname")) return false;
    return !(
      config.has("synology.self_signed") &&
      config.get("synology.self_signed") === "Y"
    );
  }
}
