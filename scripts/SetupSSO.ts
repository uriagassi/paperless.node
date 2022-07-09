import update from "./update_config.js";
import {Interface} from "readline";
import config from "config";

export class SetupSSO {

  doUpdate(rl:Interface, callback: () => any) {
    rl.question('Do you want to use Synology SSO? [Y/N] ', result => {

      if (!(result.toUpperCase() === 'Y')) {
        if (result.trim() === '') {
          if (config.get('sso.handler') === './syn_login.js') {
            console.log('currently using Synology SSO')
          } else {
            console.log('currently not using any SSO')
          }
        } else {
          console.log('not setting any SSO')
          update.merge_config({
            sso: {
              handler: "./empty_sso.js"
            }
          })
        }
        rl.question('Do you want to run HTTPS? [Y/N] ', result => {
          if (result.trim() === '') {
            console.log(`currently running HTTP${config.get('https.use') ? 'S' : ''}`)
            callback()
            return
          }
          if (result.toUpperCase() === 'Y') {
            this.setupSSL(rl, callback)
          } else {
            update.remove('cors.origins.sso')
            update.merge_config({ https: { use: false }})
            callback()
          }
        })
      } else {
        update.query(rl, 'What is your synology host name/IP?', 'synology.hostname', hostname => {
          update.query(rl, 'What is your synology https port?', 'synology.port', port => {
            update.query(rl, 'What is your appId? (see https://kb.synology.com/en-ph/DSM/help/SSOServer/sso_server_application_list?version=7)', 'synology.appId', appId => {
              update.query(rl, 'What is your synology redirect URI?', 'synology.redirect_uri', redirect_uri => {
                update.query(rl, "Is your SSO certificate self signed? [Y/N]", "synology.self_signed", isSelfSigned => {
                  update.merge_config({
                    cors: {
                      use: true,
                      origins: {sso: `https://${hostname}:${port}`}
                    },
                    sso: {handler: './syn_login.js'},
                    synology: {
                      hostname,
                      port: port ?? 443,
                      appId,
                      redirect_uri,
                      self_signed: isSelfSigned.trim().toUpperCase() === 'Y' ? 'Y' : 'N'
                    }
                  })
                  this.setupSSL(rl, callback)
                })
              })
            })
          })
        })
      }
    })
  }

  setupSSL(rl: Interface, callback: () => any) {
    update.query_for_file(rl, 'Where is your key.pem?', 'https.key', () => {
      update.query_for_file(rl, "Where is your cert.pem?", 'https.cert', () => {
        update.merge_config({ https: { use: true }})
        callback()
      })
    })
  }
}

