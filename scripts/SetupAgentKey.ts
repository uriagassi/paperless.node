import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { AgentKeys } from "../server/auth/AgentKeys.js";
import { get_config, save_config } from "./update_config.js";

interface StoredAgentKey {
  name: string;
  keyHash?: string;
  key?: string;
}

type LocalConfig = ReturnType<typeof get_config> & {
  auth?: { agentKeys?: StoredAgentKey[] };
};

function agentKeys(cfg: LocalConfig): StoredAgentKey[] {
  return cfg.auth?.agentKeys ?? [];
}

function saveAgentKeys(cfg: LocalConfig, keys: StoredAgentKey[]) {
  cfg.auth = { ...cfg.auth, agentKeys: keys };
  save_config(cfg);
}

export function addAgentKey(name: string) {
  const cfg = get_config() as LocalConfig;
  const keys = agentKeys(cfg);
  if (keys.some((k) => k.name === name)) {
    throw new Error(`An agent named "${name}" already exists`);
  }
  const key = randomBytes(32).toString("hex");
  saveAgentKeys(cfg, [...keys, { name, keyHash: AgentKeys.hash(key) }]);
  return key;
}

export function revokeAgentKey(name: string) {
  const cfg = get_config() as LocalConfig;
  const keys = agentKeys(cfg);
  if (!keys.some((k) => k.name === name)) return false;
  saveAgentKeys(
    cfg,
    keys.filter((k) => k.name !== name)
  );
  return true;
}

export function listAgentNames() {
  return agentKeys(get_config() as LocalConfig).map((k) => k.name);
}

function main(args: string[]) {
  const [command, name] = args;
  if (command === "add" && name) {
    const key = addAgentKey(name);
    console.log(`Agent "${name}" created. Its key (shown only once):\n\n${key}\n`);
    console.log("Send it as `Authorization: Bearer <key>`. Restart the server to apply.");
  } else if (command === "revoke" && name) {
    console.log(
      revokeAgentKey(name)
        ? `Agent "${name}" revoked. Restart the server to apply.`
        : `No agent named "${name}"`
    );
  } else if (command === "list") {
    listAgentNames().forEach((n) => console.log(n));
  } else {
    console.log("Usage: yarn agent_key <add <name> | revoke <name> | list>");
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  }
}
