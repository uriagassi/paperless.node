import { beforeEach, describe, expect, it } from "vitest";
import Sqlite3, { Database } from "better-sqlite3";
import { AgentTags, AgentTagError } from "./AgentTags.js";

let db: Database;

function status(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof AgentTagError) return e.status;
    throw e;
  }
  return undefined;
}

beforeEach(() => {
  db = new Sqlite3(":memory:");
  db.exec(`
    create table Tags (tagId integer primary key autoincrement, parentId integer null,
      name text not null, isExpanded integer not null);
    create unique index IX_Tags_Name on Tags(name);
  `);
});

describe("AgentTags root", () => {
  it("creates the root as agents and remembers it by id", () => {
    const tags = new AgentTags(db);
    const id = tags.rootId();
    expect(db.prepare("select name from Tags where tagId = ?").get(id)).toEqual({
      name: "agents",
    });
    expect(tags.rootId()).toBe(id);
    expect(new AgentTags(db).rootId()).toBe(id);
  });

  it("does not adopt a tag that is merely named like the root", () => {
    db.exec("insert into Tags (name, isExpanded) values ('agents', 0)");
    const id = new AgentTags(db).rootId();
    expect(db.prepare("select name from Tags where tagId = ?").get(id)).toEqual({
      name: "agents-1",
    });
  });

  it("follows the root through a rename", () => {
    const tags = new AgentTags(db);
    const id = tags.rootId();
    db.prepare("update Tags set name = 'robots' where tagId = ?").run(id);
    expect(tags.rootId()).toBe(id);
  });

  it("recreates the root when it was deleted", () => {
    const tags = new AgentTags(db);
    const id = tags.rootId();
    db.prepare("delete from Tags where tagId = ?").run(id);
    expect(tags.rootId()).not.toBe(id);
  });
});

describe("AgentTags.createTag", () => {
  it("creates tags under the root and under descendants", () => {
    const tags = new AgentTags(db);
    const a = tags.createTag("a", tags.rootId());
    const b = tags.createTag("b", a);
    expect(tags.isStrictlyUnderRoot(a)).toBe(true);
    expect(tags.isStrictlyUnderRoot(b)).toBe(true);
  });

  it("rejects parents outside the sandbox with 403", () => {
    const tags = new AgentTags(db);
    tags.rootId();
    db.exec("insert into Tags (tagId, name, isExpanded) values (100, 'taxes', 0)");
    expect(status(() => tags.createTag("x", 100))).toBe(403);
    expect(status(() => tags.createTag("x", 9999))).toBe(403);
    expect(status(() => tags.createTag("x", 0))).toBe(403);
    expect(status(() => tags.createTag("x", undefined))).toBe(403);
  });

  it("rejects a malformed parent with 400", () => {
    const tags = new AgentTags(db);
    expect(status(() => tags.createTag("x", "1; drop"))).toBe(400);
    expect(status(() => tags.createTag("x", 1.5))).toBe(400);
  });

  it("rejects empty and oversized names with 400", () => {
    const tags = new AgentTags(db);
    const root = tags.rootId();
    expect(status(() => tags.createTag("   ", root))).toBe(400);
    expect(status(() => tags.createTag("x".repeat(101), root))).toBe(400);
    expect(status(() => tags.createTag(42, root))).toBe(400);
  });

  it("rejects duplicate names anywhere, ignoring case, with 409", () => {
    const tags = new AgentTags(db);
    const root = tags.rootId();
    db.exec("insert into Tags (name, isExpanded) values ('Taxes', 0)");
    tags.createTag("a", root);
    expect(status(() => tags.createTag("A", root))).toBe(409);
    expect(status(() => tags.createTag("taxes", root))).toBe(409);
  });

  it("caps the subtree with 409 and ignores tags outside it", () => {
    const tags = new AgentTags(db, 2);
    const root = tags.rootId();
    db.exec("insert into Tags (name, isExpanded) values ('outside', 0)");
    tags.createTag("a", root);
    tags.createTag("b", root);
    expect(status(() => tags.createTag("c", root))).toBe(409);
  });

  it("defaults the cap to 500 descendants", () => {
    const tags = new AgentTags(db);
    const root = tags.rootId();
    const insert = db.prepare(
      "insert into Tags (name, isExpanded, parentId) values (?, 0, ?)"
    );
    for (let i = 0; i < 499; i++) insert.run(`t${i}`, root);
    expect(status(() => tags.createTag("last", root))).toBeUndefined();
    expect(status(() => tags.createTag("over", root))).toBe(409);
  });
});

describe("AgentTags.isStrictlyUnderRoot", () => {
  it("excludes the root, outside tags and unknown ids", () => {
    const tags = new AgentTags(db);
    const root = tags.rootId();
    db.exec("insert into Tags (tagId, name, isExpanded) values (100, 'taxes', 0)");
    expect(tags.isStrictlyUnderRoot(root)).toBe(false);
    expect(tags.isStrictlyUnderRoot(100)).toBe(false);
    expect(tags.isStrictlyUnderRoot(9999)).toBe(false);
  });

  it("terminates on a parent cycle", () => {
    const tags = new AgentTags(db);
    tags.rootId();
    db.exec(`insert into Tags (tagId, name, isExpanded, parentId) values (100, 'p', 0, 101);
             insert into Tags (tagId, name, isExpanded, parentId) values (101, 'q', 0, 100);`);
    expect(tags.isStrictlyUnderRoot(100)).toBe(false);
  });

  it("flags the whole subtree, root included", () => {
    const tags = new AgentTags(db);
    const root = tags.rootId();
    const a = tags.createTag("a", root);
    db.exec("insert into Tags (tagId, name, isExpanded) values (100, 'taxes', 0)");
    expect(tags.agentTagIds()).toEqual(new Set([root, a]));
  });
});
