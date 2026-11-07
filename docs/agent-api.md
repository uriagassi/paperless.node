# paperless.node Agent API

This page tells an automated agent how to talk to a paperless.node server. Everything below is relative to the base
URL `{BASE_URL}`.

> If the examples below show bare paths such as `/api/search` (no `http://...` in front), the server could not work out
> its own public address. Ask the user for the server's public URL and put it in front of every path, including the
> `link` values the API returns.

## Authentication

Send a key on every request:

```
Authorization: Bearer <key>
```

A missing or unknown key is rejected with `401 Invalid Token`. No CSRF token and no cookies are needed.

### Getting a key

Keys are created by a human on the machine running the server, not through the API. Ask the user to run:

```
yarn agent_key add <name>
```

It prints the key once; only a hash is stored, so a lost key means creating a new one. The user must then **restart
the server** and send you the key. Other commands: `yarn agent_key list` (names only) and
`yarn agent_key revoke <name>` (also needs a restart).

## What you may call

Everything not listed here answers `403 Not available to agents`. That is expected: agents cannot read note bodies or
attachments, change notes, or use mail, import or trash. Attachment file names are never exposed, only MIME types.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/search` | Search notes by text and date range |
| GET | `/api/notebooks` | List notebooks |
| GET | `/api/tags` | List tags |
| GET | `/api/notebooks_and_tags` | Both lists in one call |
| GET | `/api/notebooks/:id` | Notes in a notebook (paged) |
| GET | `/api/tags/:id` | Notes with a tag (paged) |
| GET | `/api/notes/:id` | Metadata of one note |
| GET | `/api/user` | Who you are authenticated as |
| POST | `/api/agent/tags` | Create a tag under the agent root |
| POST | `/api/notes/:id/addTag` | Add an agent tag to a note |
| DELETE | `/api/notes/:id/tags/:tagId` | Remove an agent tag from a note |

`HEAD` works wherever `GET` does.

## Notes

Every note an agent sees has this shape:

```json
{
  "id": 42,
  "title": "Electricity bill March",
  "notebook": { "id": 3, "name": "Bills" },
  "tags": ["utilities", "2024"],
  "createTime": "2024-03-02T10:15:00.000Z",
  "updateTime": "2024-03-02T10:15:00.000Z",
  "attachments": [{ "mime": "application/pdf" }],
  "link": "/?noteId=42"
}
```

`notebook` is `null` if the note has none. `link` is a path that opens the note in the web UI for a human; prefix it
with `{BASE_URL}` to give the user a clickable URL, e.g. `{BASE_URL}/?noteId=42`.

```
GET {BASE_URL}/api/notes/42
```

returns the object above (`404` if there is no such note).

## Searching and paging

```
GET {BASE_URL}/api/search?term=electricity&from=2024-01-01&to=2024-03-31&dateField=createTime&limit=50
```

```json
{ "notes": [ { "id": 42, "title": "Electricity bill March", "...": "..." } ] }
```

| Param | Meaning |
| --- | --- |
| `term` | Text to search for. With no `term` and no `from`/`to`, the result is empty |
| `from`, `to` | Inclusive ISO dates (`YYYY-MM-DD`); anything after the first 10 characters is ignored |
| `dateField` | `createTime` (default) or `updateTime`: which date `from`/`to` and the ordering use |
| `limit` | 1-500, default 100 |
| `lastItem` | Paging cursor, see below |

Results are newest first (by the chosen date, then note id). To get the next page, pass `lastItem` set to the day of the
last note you received followed by `|` and its id, e.g. `lastItem=2024-03-02|42`; the id keeps notes from the same day
from being skipped. Stop when a page returns fewer than `limit` notes. Bad dates or cursors return `400` with
`{ "error": "..." }`.

Notebook and tag listings page the same way, but with plain dates:

```
GET {BASE_URL}/api/notebooks/3?lastItem=0&limit=50
GET {BASE_URL}/api/tags/7?lastItem=0&limit=50
```

Always send both `lastItem` and `limit` here (`lastItem=0` means from the start). For the next page set `lastItem` to the
`createTime` of the last note received. `/api/notebooks/:id` also accepts `orderBy` (`createTime`, `updateTime` or
`title`); the cursor then applies to that field.

## Listings

```
GET {BASE_URL}/api/notebooks
```
```json
{ "notebooks": [ { "name": "Bills", "key": 3, "type": null, "notes": 120 } ] }
```

```
GET {BASE_URL}/api/tags
```
```json
{ "tags": [ { "name": "agents", "key": 9, "agent": true, "...": "..." } ] }
```

`key` is the id to use in other calls. `agent: true` marks tags inside the agent tag tree.

## Writing tags

Agents can organise notes with tags of their own, and only those. The server keeps a root tag (named `agents`, or
`agents-N` if that name was taken; find it in `GET /api/tags` as the tag with `agent: true` whose parent is none of the
other agent tags) and you may only touch tags strictly beneath it.

Create a tag; `parent` is the id of the root or of any tag below it:

```
POST {BASE_URL}/api/agent/tags
Content-Type: application/json

{ "name": "to-review", "parent": 9 }
```
```json
{ "key": 57 }
```

Attach and detach it:

```
POST {BASE_URL}/api/notes/42/addTag
Content-Type: application/json

{ "tagId": 57 }
```
```
DELETE {BASE_URL}/api/notes/42/tags/57
```

Rules and errors:

- Tags outside the agent tree, and the root itself, answer `403 Tag is not in the agent tag tree`
  (`403 Parent is not in the agent tag tree` when creating).
- Names are 1-100 characters (`400`) and must be unique among all tags, ignoring case (`409`).
- The agent tree holds at most 500 tags (`409`).
- Adding a tag to a note that does not exist is `404`.
- You cannot rename, move or delete tags.

## Who am I

```
GET {BASE_URL}/api/user
```

returns `{ "user_id": "agent:<name>", "user_name": "agent:<name>", "level": "agent" }`.

## Errors at a glance

| Status | Meaning |
| --- | --- |
| 400 | Bad parameter (dates, cursor, tag name or parent) |
| 401 | Missing or invalid key |
| 403 | Not available to agents, or a tag outside the agent tree. Expected, not a fault |
| 404 | Note not found |
| 409 | Tag name taken, or the agent tree is full |
