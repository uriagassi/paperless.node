import { Database } from "better-sqlite3";

export type DateField = "createTime" | "updateTime";

export interface SearchParams {
  term: string;
  from?: string;
  to?: string;
  dateField: DateField;
  lastItem?: string;
  limit: number;
}

export class BadSearchRequest extends Error {}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function single(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new BadSearchRequest(`${name} must be a single value`);
  return value;
}

function parseDate(value: string | undefined, name: string): string | undefined {
  if (!value) return undefined;
  const day = value.slice(0, 10);
  const parsed = new Date(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) {
    throw new BadSearchRequest(`${name} must be an ISO date`);
  }
  return day;
}

export function parseSearchParams(query: Record<string, unknown>): SearchParams {
  const dateField = single(query.dateField, "dateField") || "createTime";
  if (dateField !== "createTime" && dateField !== "updateTime") {
    throw new BadSearchRequest("dateField must be createTime or updateTime");
  }
  const rawLimit = single(query.limit, "limit");
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit)) throw new BadSearchRequest("limit must be an integer");
  const rawLastItem = single(query.lastItem, "lastItem");
  return {
    term: single(query.term, "term") ?? "",
    from: parseDate(single(query.from, "from"), "from"),
    to: parseDate(single(query.to, "to"), "to"),
    dateField,
    lastItem: rawLastItem && rawLastItem !== "0" ? parseDate(rawLastItem, "lastItem") : undefined,
    limit: Math.min(Math.max(limit, 1), MAX_LIMIT),
  };
}

export function searchNotes(db: Database, params: SearchParams) {
  if (!params.term && !params.from && !params.to) return [];

  const column = `substr(n.${params.dateField}, 1, 10)`;
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (params.term) {
    conditions.push(
      `(n.title like ? or n.noteId in \
      (select noteId from NoteTags where tagId in (select tagId from Tags where name like ?)))`
    );
    const pattern = `%${params.term}%`;
    args.push(pattern, pattern);
  }
  if (params.from) {
    conditions.push(`${column} >= ?`);
    args.push(params.from);
  }
  if (params.to) {
    conditions.push(`${column} <= ?`);
    args.push(params.to);
  }
  if (params.lastItem) {
    conditions.push(`${column} < ?`);
    args.push(params.lastItem);
  }
  args.push(params.limit);

  return db
    .prepare(
      `select n.noteId as id, n.createTime, n.updateTime, n.title, \
      GROUP_CONCAT(a.fileName) as attachments, \
      MIN(a.mime) as mime, SUM(a.size) size, count(a.attachmentId) as attachmentCount \
      from Notes n left join Attachments a on n.noteId = a.noteId \
      where ${conditions.join(" and ")} \
      group by n.noteId order by n.${params.dateField} desc, n.noteId desc limit ?`
    )
    .all(...args);
}
