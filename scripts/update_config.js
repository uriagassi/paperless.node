(function () {
  const fs = require('fs')
  const path = require('path')
  const config = require('config')
  const _ = require('lodash')

  const localConfigLocation = path.join(__dirname, '..', 'config', 'local.json');

  module.exports.config_get = (path, default_value) => {
    return config.has(path) ? config.get(path) : default_value
  }

  module.exports.get_config = () => {
    if (fs.existsSync(localConfigLocation)) {
      return JSON.parse(fs.readFileSync(localConfigLocation))
    }
    return {};
  }

  module.exports.update_config = (new_params, config_object) => {
    config_object = config_object || module.exports.get_config()
    return _.merge(config_object, new_params)
  }

  module.exports.save_config = (config_object) => {
    fs.writeFileSync(localConfigLocation, JSON.stringify(config_object, null, 2))
  }

  module.exports.merge_config = (new_params) => {
    module.exports.save_config(module.exports.update_config(new_params))
  }

  module.exports.inject = (location, value, obj = {}) => {
    const location_parts = location.split('.')
    if (location_parts.length > 1) {
      obj[location_parts[0]] = module.exports.inject(location_parts.slice(1).join('.'), value, obj[location_parts[0]])
    } else {
      obj[location_parts[0]] = value
    }
    return obj
  }

  function resolveHome(filepath) {
    if (filepath[0] === '~') {
      return path.join(process.env.HOME, filepath.slice(1));
    }
    return filepath;
  }

  module.exports.query = (rl, q, config_location, callback) => {
    rl.question(
      `${q} [${module.exports.config_get(config_location)}] `,
      response => {
        if (!response || response.trim().length === 0) {
          response = module.exports.config_get(config_location)
        }
        callback(response)
      })
  }

  module.exports.query_for_path = (rl, q, config_location, { exists: location_verified, created: created_callback, done: done_callback}) => {
    module.exports.query(rl, q, config_location, newLocation => {
        newLocation = resolveHome(newLocation.trim())
        if (newLocation.toUpperCase() === 'Q') {
          rl.close();
        }
        if (!path.isAbsolute(newLocation)) {
          console.log('Please enter a valid absolute path')
          module.exports.query_for_path(rl, q, config_location, { exists: location_verified, created: created_callback, done: done_callback})
          return;
        }
        let callback
        if (!fs.existsSync(path.join(newLocation, 'paperless.sqlite'))) {
          if (fs.existsSync(newLocation)) {
            callback = location_verified
          } else {
            fs.mkdirSync(newLocation, {recursive: true})
            callback = created_callback || location_verified
          }
        }
        if (!(!callback || !(callback(newLocation) === false))) {
          return
        }
        module.exports.merge_config(module.exports.inject(config_location, newLocation))
        done_callback()
      })
  }

})()
