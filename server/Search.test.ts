import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Sqlite3, { Database } from "better-sqlite3";
import { BadSearchRequest, parseSearchParams, searchNotes } from "./Search.js";

let db: Database;

function search(query: Record<string, string>) {
  return searchNotes(db, parseSearchParams(query)).map((n) => (n as { title: string }).title);
}

beforeEach(() => {
  db = new Sqlite3(":memory:");
  db.exec(`
    create table Notes (noteId integer primary key, notebookId int, createTime text, updateTime text, title text);
    create table Attachments (attachmentId integer primary key, noteId int, fileName text, mime text, size int);
    create table Tags (tagId integer primary key, name text);
    create table NoteTags (noteId int, tagId int);
  `);
  const insert = db.prepare("insert into Notes (title, createTime, updateTime) values (?, ?, ?)");
  insert.run("a", "2024-01-01", "2024-03-01");
  insert.run("b", "2024-01-15T13:00:00Z", "2024-02-01");
  insert.run("c", "2024-02-01", "2024-01-10");
  insert.run("d", "2024-03-01", "2024-01-20");
  db.exec("insert into Tags (name) values ('red'); insert into NoteTags values (1, 1), (4, 1)");
});

test("empty term without dates returns nothing", () => {
  assert.deepEqual(search({}), []);
  assert.deepEqual(search({ lastItem: "0", limit: "10" }), []);
});

test("date range lists newest first with inclusive bounds", () => {
  assert.deepEqual(search({ from: "2024-01-15", to: "2024-02-01" }), ["c", "b"]);
  assert.deepEqual(search({ from: "2024-02-01" }), ["d", "c"]);
  assert.deepEqual(search({ to: "2024-01-01" }), ["a"]);
});

test("datetime values count as their date for the bounds", () => {
  assert.deepEqual(search({ from: "2024-01-15", to: "2024-01-15" }), ["b"]);
  assert.deepEqual(search({ from: "2024-01-15T23:59:59Z", to: "2024-01-15T00:00:00Z" }), ["b"]);
});

test("updateTime is filtered and sorted on its own", () => {
  assert.deepEqual(search({ dateField: "updateTime", from: "2024-01-10", to: "2024-02-01" }), ["b", "d", "c"]);
});

test("from after to is an empty range", () => {
  assert.deepEqual(search({ from: "2024-03-01", to: "2024-01-01" }), []);
});

test("paging walks older notes with lastItem and limit", () => {
  assert.deepEqual(search({ from: "2024-01-01", limit: "2", lastItem: "0" }), ["d", "c"]);
  assert.deepEqual(search({ from: "2024-01-01", limit: "2", lastItem: "2024-02-01" }), ["b", "a"]);
  assert.deepEqual(search({ dateField: "updateTime", from: "2024-01-01", limit: "2", lastItem: "2024-02-01" }), [
    "d",
    "c",
  ]);
});

test("term combines with the range for title and tag matches", () => {
  assert.deepEqual(search({ term: "red", from: "2024-02-01" }), ["d"]);
  assert.deepEqual(search({ term: "b" }), ["b"]);
  assert.deepEqual(search({ term: "red" }), ["d", "a"]);
});

test("invalid input is rejected", () => {
  for (const q of [{ from: "yesterday" }, { to: "2024-13-40" }, { dateField: "title" }, { limit: "abc" }]) {
    assert.throws(() => parseSearchParams({ term: "x", ...q }), BadSearchRequest);
  }
});

test("limit defaults and is clamped", () => {
  assert.equal(parseSearchParams({ term: "x" }).limit, 100);
  assert.equal(parseSearchParams({ term: "x", limit: "9999" }).limit, 500);
  assert.equal(parseSearchParams({ term: "x", limit: "0" }).limit, 1);
});
