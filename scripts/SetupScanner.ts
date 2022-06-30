import update from "./update_config.js";
import {Interface} from "readline";

export class SetupScanner {
  doUpdate(rl : Interface, callback : () => any) {
    update.query_for_path(rl,
        'What path should the files waiting from the scanner be in?',
        'paperless.importDir', {
          done: callback
        })
  }
}
