(function() {

  const fs = require('fs')
  const update = require('./update_config')

  module.exports.doUpdate = (rl, callback) => {
    rl.question('Do you want to setup mail? [Y/N/Skip] ', do_start => {
        if (do_start.toUpperCase() === 'Y') {
          update.query(rl, "Where is your credentials.json file? (see https://developers.google.com/workspace/guides/create-credentials to create one)", 'mail.credentials', credLocation => {
            try {
              let creds = JSON.parse(fs.readFileSync(credLocation)).web
              update.query(rl, "Choose a label to listen for:", 'mail.pendingLabel', pendingLabel => {
                update.query(rl, "Choose a label to assign to processed threads:", 'mail.doneLabel', doneLabel => {
                    update.query(rl, "Choose a tag to assign to imported items:", 'mail.importedTag', importedTag => {
                        if (creds.redirect_uris.length > 1) {
                          console.log("There are multiple redirect URIs")
                          for (let i = 0; i < creds.redirect_uris.length; i++) {
                            console.log(`${i+1}. ${creds.redirect_uris[i]}`)
                          }
                          rl.question(
                            `Which Redirect URI to use? [${[...creds.redirect_uris.keys()].map(
                              i => i + 1).join('/')}] `, redirect_uri => {
      update.merge_config({mail: { redirect_uri: creds.redirect_uris[redirect_uri - 1],
          supported: true,
          credentials: credLocation,
          pendingLabel: pendingLabel,
          doneLabel: doneLabel,
          importedTag: importedTag}})
                              callback()
                            })
                        } else {
                          update.merge_config({mail: { redirect_uri: creds.redirect_uris[0],
                              supported: true,
                              credentials: credLocation,
                              pendingLabel: pendingLabel,
                              doneLabel: doneLabel,
                              importedTag: importedTag}})
                          callback()
                        }
                      })
                  })
              })
            } catch (e) {
              console.log(e)
              module.exports.doUpdate(rl, callback)
            }
          })
        } else if (do_start.toUpperCase() === 'N') {
          update.merge_config({mail: { supported: false }})
          callback()
        } else {
          callback()
        }
      }
    )
  }
})()
