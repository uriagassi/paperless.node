import fs from "fs";
import path from "path";
import {Interface} from "readline";
import fse from "fs-extra";

import { update, __basedir } from "./update_config.js";

export class SetupDB {
  doUpdate(rl : Interface, callback: () => any) {
    update.query_for_path(rl, 'What path should the DB be in?',
      'paperless.baseDir',
      {
        exists: (dbPath:string) => {
          if (!fs.existsSync(path.join(dbPath, 'paperless.sqlite'))) {
            console.log('directory already exists!')
            this.doUpdate(rl, callback)
            return false
          }
        }, created: (dbPath:string) => {
          console.log(`setting up a new database in ${dbPath}`)
          fse.copySync(path.join(__basedir, 'template'), dbPath)
          return true
        }, done: callback
      }
    )
  }
}

