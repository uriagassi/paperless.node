import { Interface } from "readline";
import config from "config";
import { merge_config } from "./update_config.js";

export class SetupHostname {
  doUpdate(rl: Interface, callback: () => unknown) {
    rl.question(
      "Is this server going to be used outside this computer? [Y/N] ",
      (result) => {
        if (result.toUpperCase() === "Y") {
          rl.question(
            "THIS OPTION SHOULD NOT BE SET WITHOUT A GOOD AUTHORIZATION SOLUTION\
        \nAre you sure you want this server to be accessible from outside? ",
            (result) => {
              if (result.toUpperCase() === "Y") {
                merge_config({ server: { localOnly: false } });
              }
              callback();
            }
          );
        } else if (result.toUpperCase() === "N") {
          merge_config({ server: { localOnly: true } });
          callback();
        } else if (result.trim() === "") {
          if (config.get("server.localOnly")) {
            console.log("currently listening only locally");
          } else {
            console.log("currently set to SERVE OUTSIDE TRAFFIC");
          }
          callback();
        } else {
          console.log("Please answer Y or N");
          this.doUpdate(rl, callback);
        }
      }
    );
  }
}
