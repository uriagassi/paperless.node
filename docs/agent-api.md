# paperless.node Agent API

Base URL: `{BASE_URL}`. Every path below hangs off it.

> Examples showing bare paths such as `/api/search` mean the server could not work out its public address. Ask the
> user for it and put it in front of every path, including the `link` values the API returns.

## Start here

1. Hold a key. Without one, ask the user for it (see "Getting a key").
2. Send `Authorization: Bearer <key>` on every request. Cookies and CSRF tokens play no part. A missing or unknown key
   gets `401 Invalid Token`.
3. Call only the endpoints in the next section. Anything else answers `403 Not available to agents`, which is the
   expected, permanent answer. Move on rather than retrying.

### Getting a key

A human creates keys on the machine running the server. Ask the user to run:

```
yarn agent_key add <name>
```

The key prints once and only its hash is stored, so a lost key means a new one. The user restarts the server and sends
you the key. `yarn agent_key list` shows names and `yarn agent_key revoke <name>` removes one (restart again).

## What you may call

Agents see note metadata (title, notebook, tags, dates, attachment MIME types and a link). Bodies, attachment files and
file names stay out of reach.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/search` | Search notes by text and date range |
| GET | `/api/notebooks` | List notebooks |
| GET | `/api/tags` | List tags |
| GET | `/api/notebooks_and_tags` | Both lists in one call |
| GET | `/api/notebooks/:id` | Notes in a notebook (paged) |
| GET | `/api/tags/:id` | Notes with a tag (paged) |
| GET | `/api/notes/:id` | Metadata of one note |
| GET | `/api/user` | Your identity: `{ "user_id": "agent:<name>", "user_name": "agent:<name>", "level": "agent" }` |
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

`notebook` is `null` if the note has none. `link` opens the note in the web UI for a human. Give the user `{BASE_URL}` plus the link, e.g.
`{BASE_URL}/?noteId=42`.

```
GET {BASE_URL}/api/notes/42
```

returns the object above, or `404` for an unknown id.

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
from being skipped. A page with fewer than `limit` notes is the last one. Bad dates or cursors return `400` with
`{ "error": "..." }`.

Notebook and tag listings page the same way, but with plain dates:

```
GET {BASE_URL}/api/notebooks/3?lastItem=0&limit=50
GET {BASE_URL}/api/tags/7?lastItem=0&limit=50
```

Send both `lastItem` and `limit` here (`lastItem=0` starts from the beginning). For the next page set `lastItem` to the
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
{ "tags": [ { "name": "agents", "key": 9, "parent": 0, "agent": true, "notes": 0 } ] }
```

`key` is the id to use in other calls. `agent: true` marks tags inside the agent tag tree.

## Writing tags

Agents organise notes with tags of their own. The server keeps a root tag (`agents`, or `agents-N` if that name was
taken) and you work with the tags strictly beneath it. `GET /api/tags` marks the root and its descendants with
`agent: true`. The root is the one whose `parent` is not itself an agent tag.

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

Rules:

- Tags outside the agent tree, and the root itself, answer `403 Tag is not in the agent tag tree` (on create, `403
  Parent is not in the agent tag tree`).
- A name is 1-100 characters (`400`) and unique among all tags, ignoring case (`409`).
- The agent tree holds at most 500 tags (`409`).
- An unknown note id is `404`.
- Tags are created, attached and detached. Renaming, moving and deleting belong to the user.

Other errors: `400` with `{ "error": "..." }` for a bad date or cursor.
