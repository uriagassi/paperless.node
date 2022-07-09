import readline from "readline";
import { SetupScanner } from "./SetupScanner.js";
import { SetupDB } from "./SetupDB.js";
import { SetupAuth } from "./SetupAuth.js";
import { SetupMail } from "./SetupMail.js";
import {SetupHostname} from "./SetupHostname.js";

const rl = readline.createInterface(process.stdin, process.stdout);

const steps = [new SetupDB(), new SetupScanner(), new SetupAuth(), new SetupMail(), new SetupHostname()]

let i = 0
const next_step = () => {
  if (i < steps.length) {
    steps[i++].doUpdate(rl, next_step)
  } else {
    rl.close()
  }
}
next_step()

