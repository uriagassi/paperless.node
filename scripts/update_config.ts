import { Interface } from "readline";
import fs from "fs";
import path from "path";
import _ from "lodash";
import config from "config";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
export const __basedir = path.join(__dirname, "..");

const localConfigLocation = path.join(__basedir, "config", "local.json");
export function config_get(
  path: string,
  default_value?: string
): string | undefined {
  return config.has(path) ? config.get(path) : default_value;
}

export function get_config(): Config {
  if (fs.existsSync(localConfigLocation)) {
    return JSON.parse(fs.readFileSync(localConfigLocation, "utf-8")) as Config;
  }
  return {};
}

export function update_config(new_params: Config, config_object?: Config) {
  config_object = config_object || get_config();
  return _.merge(config_object, new_params);
}

export function save_config(config_object: Config) {
  fs.writeFileSync(localConfigLocation, JSON.stringify(config_object, null, 2));
}

export function merge_config(new_params: Config) {
  save_config(update_config(new_params));
}

export function inject(location: string, value: string, obj: Config = {}) {
  const location_parts = location.split(".");
  if (location_parts.length > 1) {
    obj[location_parts[0]] = inject(
      location_parts.slice(1).join("."),
      value,
      obj[location_parts[0]] as Config
    );
  } else {
    obj[location_parts[0]] = value;
  }
  return obj;
}

export function remove(location: string) {
  save_config(remove_from(location));
}

export function remove_from(location: string, obj: Config = get_config()) {
  const location_parts = location.split(".");
  if (location_parts.length > 1 && obj[location_parts[0]]) {
    obj[location_parts[0]] = remove_from(
      location_parts.slice(1).join("."),
      obj[location_parts[0]] as Config
    );
  } else {
    obj[location_parts[0]] = undefined;
  }
  return obj;
}

function resolveHome(filepath: string) {
  if (filepath[0] === "~") {
    return path.join(process.env.HOME ?? "", filepath.slice(1));
  }
  return filepath;
}

export function query(
  rl: Interface,
  q: string,
  config_location: string,
  callback: (s: string) => unknown
) {
  rl.question(
    `${q} [${config_get(config_location)}] `,
    (response: string | undefined) => {
      if (!response || response.trim().length === 0) {
        response = config_get(config_location);
      }
      callback(response ?? "");
    }
  );
}

export function query_for_path(
  rl: Interface,
  q: string,
  config_location: string,
  {
    exists,
    created,
    done,
  }: {
    exists?: (s: string) => unknown;
    created?: (s: string) => unknown;
    done?: () => unknown;
  }
) {
  query(rl, q, config_location, (newLocation: string) => {
    newLocation = resolveHome(newLocation.trim());
    if (newLocation.toUpperCase() === "Q") {
      rl.close();
    }
    if (!path.isAbsolute(newLocation)) {
      console.log("Please enter a valid absolute path");
      query_for_path(rl, q, config_location, { exists, created, done });
      return;
    }
    let callback: ((s: string) => unknown) | undefined;
    if (!fs.existsSync(path.join(newLocation, "paperless.sqlite"))) {
      if (fs.existsSync(newLocation)) {
        callback = exists;
      } else {
        fs.mkdirSync(newLocation, { recursive: true });
        callback = created || exists;
      }
    }
    if (!(!callback || !(callback(newLocation) === false))) {
      return;
    }
    merge_config(inject(config_location, newLocation));
    done?.();
  });
}

export function query_for_file(
  rl: Interface,
  q: string,
  config_location: string,
  callback: (s: string) => unknown
) {
  query(rl, q, config_location, (newLocation: string) => {
    newLocation = resolveHome(newLocation.trim());
    if (newLocation.toUpperCase() === "Q") {
      rl.close();
    }
    if (!path.isAbsolute(newLocation)) {
      console.log("Please enter a valid absolute path");
      query_for_file(rl, q, config_location, callback);
      return;
    }
    if (!fs.existsSync(newLocation)) {
      console.log("Please enter a valid file");
      query_for_file(rl, q, config_location, callback);
      return;
    }
    merge_config(inject(config_location, newLocation));
    callback(newLocation);
  });
}

interface Config {
  [key: string]: string | boolean | Config | undefined;
}
