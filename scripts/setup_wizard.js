const readline = require('readline')
const db = require('./setup_db')
const scanner = require('./setup_scanner')
const sso = require('./setup_sso')
const mail = require('./setup_mail')

const rl = readline.createInterface(process.stdin, process.stdout);

const steps = [db, scanner, sso, mail]

let i = 0
const next_step = () => {
  if (i < steps.length) {
    steps[i++].doUpdate(rl, next_step)
  } else {
    rl.close()
  }
}
next_step()

