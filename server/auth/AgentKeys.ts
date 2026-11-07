import { createHash, timingSafeEqual } from "crypto";

export interface AgentKeyConfig {
  name?: string;
  key?: string;
  keyHash?: string;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export class AgentKeys {
  private constructor(
    private readonly entries: { name: string; digest: Buffer }[]
  ) {}

  static fromConfig(configured: readonly AgentKeyConfig[] | undefined) {
    const entries: { name: string; digest: Buffer }[] = [];
    for (const [i, entry] of (configured ?? []).entries()) {
      const where = `auth.agentKeys[${i}]`;
      const name = entry.name?.trim();
      if (!name) throw new Error(`${where}: name is required`);
      if (entries.some((e) => e.name === name)) {
        throw new Error(`${where}: duplicate agent name "${name}"`);
      }
      if (entry.key && entry.keyHash) {
        throw new Error(`${where}: set either key or keyHash, not both`);
      }
      let digest: Buffer;
      if (entry.keyHash) {
        if (!/^[0-9a-f]{64}$/i.test(entry.keyHash)) {
          throw new Error(`${where}: keyHash must be a hex SHA-256`);
        }
        digest = Buffer.from(entry.keyHash, "hex");
      } else if (entry.key) {
        digest = sha256(entry.key);
      } else {
        throw new Error(`${where}: key or keyHash is required`);
      }
      if (entries.some((e) => e.digest.equals(digest))) {
        throw new Error(`${where}: duplicate key for agent "${name}"`);
      }
      entries.push({ name, digest });
    }
    return new AgentKeys(entries);
  }

  static hash(key: string) {
    return sha256(key).toString("hex");
  }

  match(token: string): string | undefined {
    const candidate = sha256(token);
    let matched: string | undefined;
    for (const entry of this.entries) {
      if (timingSafeEqual(candidate, entry.digest)) matched = entry.name;
    }
    return matched;
  }
}
