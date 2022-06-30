import readline from "readline";
import { SetupScanner } from "./SetupScanner.js";
import { SetupDB } from "./SetupDB.js";
import { SetupSSO } from "./SetupSSO.js";
import { SetupMail } from "./SetupMail.js";

const rl = readline.createInterface(process.stdin, process.stdout);

const steps = [new SetupDB(), new SetupScanner(), new SetupSSO(), new SetupMail()]

let i = 0
const next_step = () => {
  if (i < steps.length) {
    steps[i++].doUpdate(rl, next_step)
  } else {
    rl.close()
  }
}
next_step()

