// server/index.js

import config from "config";
import https from "https";
import fs from "fs";
import consoleStamp from "console-stamp";
import { app, IS_PROXY } from "./app.js";

consoleStamp(console);

const PORT: number =
  process.env.PORT || IS_PROXY
    ? config.get("server.proxyPort")
    : config.get("server.port");

const hostname =
  config.get("server.localOnly") == true ? "127.0.0.1" : "0.0.0.0";
if (!IS_PROXY && config.has("https.use") && config.get("https.use") == true) {
  const key = fs.readFileSync(config.get("https.key"));
  const cert = fs.readFileSync(config.get("https.cert"));
  https
    .createServer({ key: key, cert: cert }, app)
    .listen(PORT, hostname, () => {
      console.log(`Server listening on https://${hostname}:${PORT}`);
    });
} else {
  app.listen(PORT, hostname, () => {
    console.log(`Server listening on http://${hostname}:${PORT}`);
  });
}
