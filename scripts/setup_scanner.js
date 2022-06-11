(function () {
  const update = require('./update_config')

  module.exports.doUpdate = (rl, callback) => {
    update.query_for_path(rl,
      'What path should the files waiting from the scanner be in?',
      'paperless.importDir', {
        done: callback
      })
  }

})()
