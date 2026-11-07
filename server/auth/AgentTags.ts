import { Database } from "better-sqlite3";

export const AGENT_TAG_CAP = 500;
const MAX_NAME_LENGTH = 100;
const MAX_DEPTH = 1000;
const ROOT_NAME = "agents";
const ROOT_SETTING = "agentRootTagId";

export class AgentTagError extends Error {
  constructor(readonly status: 400 | 403 | 409, message: string) {
    super(message);
  }
}

export class AgentTags {
  constructor(
    private readonly db: Database,
    private readonly cap: number = AGENT_TAG_CAP
  ) {
    db.exec(
      "create table if not exists AgentSettings (key text primary key, value text not null)"
    );
  }

  rootId(): number {
    const stored = this.db
      .prepare("select value from AgentSettings where key = ?")
      .get(ROOT_SETTING) as { value: string } | undefined;
    if (stored) {
      const id = Number(stored.value);
      if (this.db.prepare("select 1 from Tags where tagId = ?").get(id)) return id;
    }
    const id = Number(
      this.db
        .prepare("insert into Tags (name, isExpanded) values (?, 0)")
        .run(this.freeRootName()).lastInsertRowid
    );
    this.db
      .prepare("insert or replace into AgentSettings (key, value) values (?, ?)")
      .run(ROOT_SETTING, String(id));
    return id;
  }

  private freeRootName(): string {
    const taken = new Set(
      (
        this.db.prepare("select lower(name) as name from Tags").all() as {
          name: string;
        }[]
      ).map((r) => r.name)
    );
    if (!taken.has(ROOT_NAME)) return ROOT_NAME;
    let n = 1;
    while (taken.has(`${ROOT_NAME}-${n}`)) n++;
    return `${ROOT_NAME}-${n}`;
  }

  isStrictlyUnderRoot(tagId: number): boolean {
    const root = this.rootId();
    const parentOf = this.db.prepare("select parentId from Tags where tagId = ?");
    const seen = new Set<number>();
    let current: number | null = tagId;
    for (let depth = 0; depth < MAX_DEPTH && current != null; depth++) {
      if (seen.has(current)) return false;
      seen.add(current);
      const row = parentOf.get(current) as { parentId: number | null } | undefined;
      if (!row) return false;
      if (row.parentId === root) return current !== root;
      current = row.parentId;
    }
    return false;
  }

  agentTagIds(): Set<number> {
    const root = this.rootId();
    const rows = this.db
      .prepare(
        `with recursive subtree(tagId) as (
           select ? union select t.tagId from Tags t join subtree s on t.parentId = s.tagId
         ) select tagId from subtree`
      )
      .all(root) as { tagId: number }[];
    return new Set(rows.map((r) => r.tagId));
  }

  createTag(name: unknown, parent: unknown): number {
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > MAX_NAME_LENGTH
    ) {
      throw new AgentTagError(400, `Tag name must be 1-${MAX_NAME_LENGTH} characters`);
    }
    if (parent !== undefined && parent !== null && !Number.isInteger(parent)) {
      throw new AgentTagError(400, "Parent must be an integer tag id");
    }
    const root = this.rootId();
    if (
      typeof parent !== "number" ||
      (parent !== root && !this.isStrictlyUnderRoot(parent))
    ) {
      throw new AgentTagError(403, "Parent is not in the agent tag tree");
    }
    if (this.agentTagIds().size - 1 >= this.cap) {
      throw new AgentTagError(409, `Agent tag tree is full (${this.cap} tags)`);
    }
    const trimmed = name.trim();
    if (
      this.db.prepare("select 1 from Tags where lower(name) = lower(?)").get(trimmed)
    ) {
      throw new AgentTagError(409, "A tag with this name already exists");
    }
    return Number(
      this.db
        .prepare("insert into Tags (name, isExpanded, parentId) values (?, 0, ?)")
        .run(trimmed, parent).lastInsertRowid
    );
  }
}
