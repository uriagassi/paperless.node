// server/index.js

import express from "express";
import bodyParser from "body-parser";
import config from "config";
import Sqlite3, { Statement } from "better-sqlite3";
import cookieParser from "cookie-parser";
import { AddNotes } from "./AddNotes.js";
import { Gmail } from "./Gmail.js";
import { prepare_many } from "./sql_helper.js";
import { Trash } from "./Trash.js";
import { Attachments } from "./Attachment.js";
import { Tags } from "./Tags.js";
import { Notes } from "./Notes.js";
import https from "https";
import fs from "fs";
import cors from "cors";
import { Auth } from "./auth/Auth.js";
import helmet from "helmet";
import csrf from "csurf";
import consoleStamp from "console-stamp";

consoleStamp(console)

const IS_PROXY = process.argv[process.argv.length - 1] === "proxy";
const PORT: number =
  process.env.PORT || IS_PROXY
    ? config.get("server.proxyPort")
    : config.get("server.port");
const baseDir = config.get("paperless.baseDir");
const db = new Sqlite3(baseDir + "/paperless.sqlite", { verbose: console.log });
const app = express();
const { AuthHandler } = await import(config.get("auth.handler"));
const att = new Attachments(db);
const tagservice = new Tags(db);
const notes = new Notes(db, att, tagservice);

const tag_query = db.prepare(
  "select name, tags.tagId as key, ifnull(parentId, 0) as parent, \
  isExpanded, count(NoteTags.tagId) as notes \
  from Tags left join NoteTags on Tags.tagId=NoteTags.tagId \
  group by Tags.tagId order by name"
);
const notebooks_query = db.prepare(
  "select name as name, Notebooks.notebookId as key, type as type, count(Notes.title) as notes \
  from Notebooks left join Notes on Notes.notebookId=key group by key order by name"
);

const csrfProtection = csrf({ cookie: true });

app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        objectSrc: ["'self'"],
      },
    },
  })
);
const auth = new Auth(new AuthHandler());
app.use((req, res, next) => auth.auth(req, res, next));
app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
if (!IS_PROXY && config.has("cors.use") && config.get("cors.use") == true) {
  const origins = Object.entries(config.get("cors.origins")).map(
    ([, v]) => v
  ) as string[];
  if (origins.length > 0) {
    app.use(cors({ origin: origins }));
  }
}

app.get("/api/tags", (req, res) => {
  const tags = tag_query.all().map((r) => {
    r.parent = r.parent || 0;
    return r;
  });
  res.json({ tags: tags });
});

app.get("/api/notebooks", (req, res) => {
  const result = { notebooks: notebooks_query.all() };
  res.json(result);
});

app.get("/api/notebooks_and_tags", (req, res) => {
  const tags = tag_query.all().map((r) => {
    r.parent = r.parent || 0;
    return r;
  });
  res.json({ notebooks: notebooks_query.all(), tags: tags });
});

const add_notebook = db.prepare("insert into Notebooks (name) values (?)");

app.post("/api/notebooks/:name", csrfProtection, (req, res) => {
  res.json(add_notebook.run(req.params.name));
});

const notes_by_notebook_query = ['createTime', 'updateTime', 'title'].reduce((m: { [key: string]: Statement }, t: string) => {
  m[t] = db.prepare(
    `select n.noteId as id, createTime, title, \
  GROUP_CONCAT(a.fileName) as attachments, \
  MIN(a.mime) as mime, SUM(a.size) size from Notes n left join Attachments a on id = a.noteId \
  where notebookId = ? and ${t} > ? group by id order by ${t} desc limit ?`);
  return m;
}, {});

app.get("/api/notebooks/:notebookId", (req, res) => {
  res.json({
    notes: notes_by_notebook_query[`${req.query.orderBy ?? 'createTime'}`].all(
      req.params.notebookId,
      req.query.lastItem,
      req.query.limit
    ),
  });
});

const notes_by_tag_query = db.prepare(
  "select n.noteId as id, createTime, title, \
  GROUP_CONCAT(a.fileName) as attachments, \
  MIN(a.mime) as mime, SUM(a.size) size \
  from NoteTags nt, Notes n left join Attachments a on id = a.noteId \
  where nt.tagId = ? and nt.noteId = id and createTime > ? \
  group by id order by createTime desc limit ?"
);

app.get("/api/tags/:tagId", (req, res) => {
  res.json({
    notes: notes_by_tag_query.all(
      req.params.tagId,
      req.query.lastItem,
      req.query.limit
    ),
  });
});

const notes_by_text_query = prepare_many(
  db,
  "select n.noteId as id, createTime, title, \
  GROUP_CONCAT(a.fileName) as attachments, \
  MIN(a.mime) as mime, SUM(a.size) size \
  from Notes n left join Attachments a on id = a.noteId \
  where title like $text or id in (#noteIds) \
  and createTime > $createTime group by id order by createTime desc limit $limit",
  "#noteIds"
);

const notes_by_tag_name_query = db
  .prepare(
    "select distinct noteId from NoteTags where tagId in (select tagId from Tags where name like ?)"
  )
  .raw();

app.get("/api/search", (req, res) => {
  const queryText = req.query.term ? "%" + req.query.term + "%" : "nonono!";
  let notesFromTagQuery = notes_by_tag_name_query
    .all(queryText)
    .flatMap((i) => i);
  if (notesFromTagQuery.length == 0) notesFromTagQuery = [-1];
  res.json({
    notes: notes_by_text_query(notesFromTagQuery.length).all(
      {
        text: queryText,
        createTime: req.query.lastItem,
        limit: req.query.limit,
      },
      notesFromTagQuery
    ),
  });
});

const select_note = db.prepare(
  "select notebookId, title, createTime, \
  GROUP_CONCAT(t.name) tags, GROUP_CONCAT(t.tagId) tagIds \
  from Notes n left join NoteTags nt on n.noteId = nt.noteId left join Tags t on t.tagId=nt.tagId \
  where n.noteId = ?"
);

const select_attachments = db.prepare(
  "select attachmentId as id, fileName, uniqueFileName \
from Attachments where noteId = ?"
);

app.get("/api/notes/:noteId", (req, res) => {
  res.json({
    ...select_note.get(req.params.noteId),
    attachments: select_attachments.all(req.params.noteId),
    parts: notes.parts(req.params.noteId),
  });
});

app.post("/api/notes/:noteId/split", csrfProtection, (req, res) => {
  notes.splitNote(req.user_name ?? "", +req.params.noteId);
  res.json("OK");
});

app.get("/api/body/:noteId", (req, res) => {
  res.set("Content-Type", "text/html");
  res.send(Buffer.from(notes.html(notes.body(req.params.noteId))));
});

app.use("/api/body/attachments", express.static(baseDir + "/attachments"));
app.use("/api/body/css", express.static("server/public/css"));
app.use("/api/body/js", express.static("server/public/js"));
app.use("/api/body/images", express.static("server/public/images"));

if (!IS_PROXY) {
  app.use(express.static("client/dist"));
  app.use("/", express.static("client/dist/index.html"));
  app.use("/gmail", express.static("client/dist/index.html"));
}

const update_note = db.prepare(
  "update Notes set title = $title, createTime = $createTime, notebookId = $notebookId, updateTime = date('now'), updatedBy = $updatedBy where noteId = $noteId"
);

app.post("/api/notes/:noteId", csrfProtection, (req, res) => {
  res.json(
    update_note.run({ ...req.params, ...req.body, updatedBy: req.user_name })
  );
});

const move_notes = prepare_many(
  db,
  "update Notes set notebookId = ?, updateTime = date('now'), updatedBy = ? where noteId in (#noteIds)",
  "#noteIds"
);
const find_notebook = db.prepare(
  "select notebookId from Notebooks where type=?"
);

app.post(
  "/api/notes/:noteIds/notebook/:notebookId",
  csrfProtection,
  (req, res) => {
    const ids = req.params.noteIds.split(",");
    let notebookId = req.params.notebookId;
    if (isNaN(+req.params.notebookId)) {
      notebookId = find_notebook.get(req.params.notebookId).notebookId;
    }
    res.json(move_notes(ids.length).run(notebookId, req.user_name, ...ids));
  }
);

const add_tag_to_note = db.prepare(
  "insert into NoteTags (noteId, tagId) values ($noteId, $tagId)"
);

app.post("/api/notes/:noteId/addTag", csrfProtection, (req, res) => {
  res.json(add_tag_to_note.run({ ...req.params, ...req.body }));
});

const remove_tag_from_note = db.prepare(
  "delete from NoteTags where noteId=$noteId and tagId=$tagId"
);

app.delete("/api/notes/:noteId/tags/:tagId", csrfProtection, (req, res) => {
  res.json(remove_tag_from_note.run(req.params));
});

const add_new_tag = db.prepare(
  "insert into Tags (name, isExpanded, parentId) values ($name, false, $parent)"
);

app.put("/api/tags/new", (req, res) => {
  const r = add_new_tag.run({ parent: undefined, ...req.body });
  console.log(r);
  res.json({ key: r.lastInsertRowid });
});

const update_tag = db.prepare(
  "update Tags set name = $name, parentId = $parent where tagId = $tagId"
);

app.post("/api/tags/:tagId", csrfProtection, (req, res) => {
  if (req.body.parent === 0) {
    req.body.parent = undefined;
  }
  if (req.params.tagId === "-1") {
    res.json({ key: add_new_tag.run(req.body).lastInsertRowid });
  } else {
    res.json(update_tag.run({ ...req.params, ...req.body }));
  }
});

const update_tag_expand = db.prepare(
  "update Tags set isExpanded = $expanded where tagId = $tagId"
);

app.post("/api/tags/:tagId/expand", csrfProtection, (req, res) => {
  res.json(update_tag_expand.run({ ...req.params, ...req.body }));
});

app.get("/api/user", (req, res) => {
  res.json({
    user_id: req.user_id,
    user_name: req.user_name,
  });
});

app.get("/api/logout", (req, res) => {
  console.log(req.cookies);
  for (const c in req.cookies) {
    console.log("clearing cookie " + c);
    res.clearCookie(c);
  }
  res.json("OK");
});

const delete_tag = db.prepare("delete from Tags where tagId = ?");
const empty_tag = db.prepare("delete from NoteTags where tagId = ?");
const move_child_tags_to_parent = db.prepare(
  "update Tags set parentId = (select parentId from Tags where tagid=$tagId) where parentId = $tagId"
);

app.delete("/api/tags/:tagId", csrfProtection, (req, res) => {
  empty_tag.run(req.params.tagId);
  move_child_tags_to_parent.run(req.params);
  res.json(delete_tag.run(req.params.tagId));
});

const delete_notebook = db.prepare(
  "delete from Notebooks where notebookId = ?"
);
const empty_notebook = db.prepare(
  "update Notes set notebookId = (select notebookId from Notebooks where Type = 'I') where notebookId = ?"
);

app.delete("/api/notebooks/:notebookId", csrfProtection, (req, res) => {
  empty_notebook.run(req.params.notebookId);
  res.json(delete_notebook.run(req.params.notebookId));
});

new AddNotes(notes, att, csrfProtection).listen(app);

if (config.has("mail.credentials")) {
  new Gmail(notes, att, csrfProtection).listen(app);
}

new Trash(db, csrfProtection).listen(app);

app.get("/csrf", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

const hostname =
  config.get("server.localOnly") == true ? "127.0.0.1" : "0.0.0.0";
if (!IS_PROXY && config.has("https.use") && config.get("https.use") == true) {
  const key = fs.readFileSync(config.get("https.key"));
  const cert = fs.readFileSync(config.get("https.cert"));
  https
    .createServer({ key: key, cert: cert }, app)
    .listen(PORT, hostname, () => {
      console.log(`Server listening on https://${hostname}:${PORT}`);
    });
} else {
  app.listen(PORT, hostname, () => {
    console.log(`Server listening on http://${hostname}:${PORT}`);
  });
}
