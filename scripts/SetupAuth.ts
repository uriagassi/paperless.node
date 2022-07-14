import {
  merge_config,
  query,
  query_for_file,
  remove,
} from "./update_config.js";
import { Interface } from "readline";
import config from "config";

export class SetupAuth {
  doUpdate(rl: Interface, callback: () => unknown) {
    rl.question("Do you want to use Synology SSO? [Y/N] ", (result) => {
      if (!(result.toUpperCase() === "Y")) {
        if (result.trim() === "") {
          if (config.get("auth.handler") === "./auth/SynologySSO.js") {
            console.log("currently using Synology SSO");
          } else {
            console.log("currently not using any Auth");
          }
        } else {
          console.log("not setting any Auth");
          merge_config({
            auth: {
              handler: "./auth/EmptyAuth.js",
            },
          });
        }
        rl.question("Do you want to run HTTPS? [Y/N] ", (result) => {
          if (result.trim() === "") {
            console.log(
              `currently running HTTP${config.get("https.use") ? "S" : ""}`
            );
            callback();
            return;
          }
          if (result.toUpperCase() === "Y") {
            this.setupSSL(rl, callback);
          } else {
            remove("cors.origins.sso");
            merge_config({ https: { use: false } });
            callback();
          }
        });
      } else {
        query(
          rl,
          "What is your synology host name/IP?",
          "synology.hostname",
          (hostname) => {
            query(
              rl,
              "What is your synology https port?",
              "synology.port",
              (port) => {
                query(
                  rl,
                  "What is your appId? (see https://kb.synology.com/en-ph/DSM/help/SSOServer/sso_server_application_list?version=7)",
                  "synology.appId",
                  (appId) => {
                    query(
                      rl,
                      "What is your synology redirect URI?",
                      "synology.redirect_uri",
                      (redirect_uri) => {
                        query(
                          rl,
                          "Is your SSO certificate self signed? [Y/N]",
                          "synology.self_signed",
                          (isSelfSigned) => {
                            merge_config({
                              cors: {
                                use: true,
                                origins: { sso: `https://${hostname}:${port}` },
                              },
                              auth: { handler: "./auth/SynologySSO.js" },
                              synology: {
                                hostname,
                                port: port ?? 443,
                                appId,
                                redirect_uri,
                                self_signed:
                                  isSelfSigned.trim().toUpperCase() === "Y"
                                    ? "Y"
                                    : "N",
                              },
                            });
                            this.setupSSL(rl, callback);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    });
  }

  setupSSL(rl: Interface, callback: () => unknown) {
    query_for_file(rl, "Where is your key.pem?", "https.key", () => {
      query_for_file(rl, "Where is your cert.pem?", "https.cert", () => {
        merge_config({ https: { use: true } });
        callback();
      });
    });
  }
}
