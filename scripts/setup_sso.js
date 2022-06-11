(function() {
  const update = require('./update_config')

  module.exports.doUpdate = (rl, callback) => {
    rl.question('Do you want to use Synology SSO? [Y/N] ', result => {
      if (!(result.toUpperCase() === 'Y')) {
        update.merge_config({ sso: {
          handler: "./empty_sso"
        }})
        callback()
      } else {
        rl.question(`What is your synology host name/IP? [${update.config_get('synology.hostname')}] `, hostname => {
          rl.question(`What is your synology https port? [${update.config_get('synology.port')}] `, port => {
            rl.question(`What is your appId? (see https://kb.synology.com/en-ph/DSM/help/SSOServer/sso_server_application_list?version=7) [${config_get('synology.appId')}] `, appId => {
              update.merge_config({ sso: './syn_login',
              synology: { hostname: hostname, port: port ?? 443, appId: appId}})
              callback()
            })
          })
        })
      }
    })
  }
})()
