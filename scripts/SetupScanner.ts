import { Interface } from "readline";
import { query_for_path } from "./update_config.js";

export class SetupScanner {
  doUpdate(rl: Interface, callback: () => unknown) {
    query_for_path(
      rl,
      "What path should the files waiting from the scanner be in?",
      "paperless.importDir",
      {
        done: callback,
      }
    );
  }
}
