import { describe, expect, it } from "vitest";
import Sqlite3 from "better-sqlite3";
import { agentView } from "./AgentView.js";

function db() {
  const d = new Sqlite3(":memory:");
  d.exec(`
    create table Notebooks (notebookId integer primary key, name text);
    create table Notes (noteId integer primary key, notebookId integer, createTime text, updateTime text, title text);
    create table Tags (tagId integer primary key, name text);
    create table NoteTags (noteId integer, tagId integer);
    create table Attachments (attachmentId integer primary key, noteId integer, mime text);
    insert into Notes values (1, 99, '2024-01-01', '2024-01-02', 'Orphan');
  `);
  return d;
}

describe("agentView", () => {
  it("reports a null notebook when the notebook row is missing", () => {
    expect(agentView(db())(1)?.notebook).toBeNull();
  });

  it("returns undefined for a missing note", () => {
    expect(agentView(db())(2)).toBeUndefined();
  });
});
