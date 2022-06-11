(function () {
  const fs = require('fs')
  const fse = require('fs-extra')
  const path = require('path')
  const update = require('./update_config')

  module.exports.doUpdate = (rl, callback) => {
    update.query_for_path(rl, 'What path should the DB be in?',
      'paperless.baseDir',
      {
        exists: dbPath => {
          if (!fs.existsSync(path.join(dbPath, 'paperless.sqlite'))) {
            console.log('directory already exists!')
            doUpdate()
            return false
          }
        }, created: dbPath => {
          console.log(`setting up a new database in ${dbPath}`)
          let err = fse.copySync(path.join(__dirname, '..', 'template'), dbPath)
          if (err) {
            console.log(`err: ${err}`);
            return false
          }
          return true
        }, done: callback
      }
    )
  }
})()
