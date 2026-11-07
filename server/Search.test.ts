import { test, beforeEach, expect } from "vitest";
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
  expect(search({})).toEqual([]);
  expect(search({ lastItem: "0", limit: "10" })).toEqual([]);
});

test("date range lists newest first with inclusive bounds", () => {
  expect(search({ from: "2024-01-15", to: "2024-02-01" })).toEqual(["c", "b"]);
  expect(search({ from: "2024-02-01" })).toEqual(["d", "c"]);
  expect(search({ to: "2024-01-01" })).toEqual(["a"]);
});

test("datetime values count as their date for the bounds", () => {
  expect(search({ from: "2024-01-15", to: "2024-01-15" })).toEqual(["b"]);
  expect(search({ from: "2024-01-15T23:59:59Z", to: "2024-01-15T00:00:00Z" })).toEqual(["b"]);
});

test("updateTime is filtered and sorted on its own", () => {
  expect(search({ dateField: "updateTime", from: "2024-01-10", to: "2024-02-01" })).toEqual(["b", "d", "c"]);
});

test("from after to is an empty range", () => {
  expect(search({ from: "2024-03-01", to: "2024-01-01" })).toEqual([]);
});

test("paging walks older notes with lastItem and limit", () => {
  expect(search({ from: "2024-01-01", limit: "2", lastItem: "0" })).toEqual(["d", "c"]);
  expect(search({ from: "2024-01-01", limit: "2", lastItem: "2024-02-01" })).toEqual(["b", "a"]);
  expect(search({ dateField: "updateTime", from: "2024-01-01", limit: "2", lastItem: "2024-02-01" })).toEqual([
    "d",
    "c",
  ]);
});

test("term combines with the range for title and tag matches", () => {
  expect(search({ term: "red", from: "2024-02-01" })).toEqual(["d"]);
  expect(search({ term: "b" })).toEqual(["b"]);
  expect(search({ term: "red" })).toEqual(["d", "a"]);
});

test("invalid input is rejected", () => {
  for (const q of [{ from: "yesterday" }, { to: "2024-13-40" }, { dateField: "title" }, { limit: "abc" }]) {
    expect(() => parseSearchParams({ term: "x", ...q })).toThrow(BadSearchRequest);
  }
});

test("limit defaults and is clamped", () => {
  expect(parseSearchParams({ term: "x" }).limit).toBe(100);
  expect(parseSearchParams({ term: "x", limit: "9999" }).limit).toBe(500);
  expect(parseSearchParams({ term: "x", limit: "0" }).limit).toBe(1);
});
