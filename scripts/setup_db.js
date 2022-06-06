const readline = require('readline')
const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')

const rl = readline.createInterface(process.stdin, process.stdout)


rl.question('Do you want a new DB, or do you want to mount an existing DB? ([N]ew, [E]xisting): ', result => {
  if (result.toUpperCase().startsWith('N')) {
    createNew()
  } else {
    mountDB()
  }
})

function createNew() {
  rl.question('Where do you want your new DB? ', result => {
    if (result.toUpperCase() === 'Q') {
      return;
    }
    if (fs.existsSync(result)) {
      console.log('directory already exists!')
      createNew()
    } else {
      fs.mkdirSync(result, {recursive: true})
      let err = fse.copySync(path.join(__dirname, '..', 'template'), result)
        if (err) {
          console.log(`err: ${err}`);
        } else {
          mountDB(result)
        }
    }
  })
}

function mountDB(location) {
  if (!location) {
    rl.question("Where is your DB? ", result => {
      mountDB(result);
    })
  } else {
    let localConfig = {};
    const localConfigLocation = path.join(__dirname, '..', 'config', 'local.json');
    if (fs.existsSync(localConfigLocation)) {
      localConfig = JSON.parse(fs.readFileSync(localConfigLocation))
    }
    if (!localConfig.paperless) {
      localConfig.paperless = {}
    }
    localConfig.paperless.baseDir = location.trim()
    fs.writeFileSync(localConfigLocation, JSON.stringify(localConfig, null, 2))
    rl.close()
  }
}
