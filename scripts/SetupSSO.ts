import update from "./update_config.js";
import {Interface} from "readline";

export class SetupSSO {

  doUpdate(rl:Interface, callback: () => any) {
    rl.question('Do you want to use Synology SSO? [Y/N] ', result => {
      if (!(result.toUpperCase() === 'Y')) {
        update.merge_config({ sso: {
          handler: "./empty_sso.js"
        }})
        callback()
      } else {
        update.query(rl, 'What is your synology host name/IP?', 'synology.hostname', hostname => {
          update.query(rl, 'What is your synology https port?', 'synology.port', port => {
            update.query(rl, 'What is your appId? (see https://kb.synology.com/en-ph/DSM/help/SSOServer/sso_server_application_list?version=7)', 'synology.appId', appId => {
              update.merge_config({ sso: {handler: './syn_login.js' },
              synology: { hostname: hostname, port: port ?? 443, appId: appId}})
              callback()
            })
          })
        })
      }
    })
  }
}

