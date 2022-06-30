// server/index.js

import express from "express";
import bodyParser from "body-parser";
import config from "config";
import Sqlite3 from "better-sqlite3";
import cookieParser from "cookie-parser";
import {AddNotes} from "./AddNotes.js";
import {Gmail} from "./Gmail.js";
import {sql_helper} from "./sql_helper.js";
import {Trash} from "./Trash.js";
import {Attachments} from "./Attachment.js";
import {Tags} from "./Tags.js";
import {Notes} from "./Notes.js";

const PORT = process.env.PORT || config.get('server.port');
const baseDir = config.get('paperless.baseDir')
const db = new Sqlite3(baseDir + '/paperless.sqlite', { verbose: console.log});
const app = express();
const { sso } = await import(config.get('sso.handler'))
const att = new Attachments(db)
const tagservice = new Tags(db)
const notes = new Notes(db, att, tagservice)

const tag_query = db.prepare(
  'select name, tags.tagId as key, ifnull(parentId, 0) as parent, \
  isExpanded, count(NoteTags.tagId) as notes \
  from Tags left join NoteTags on Tags.tagId=NoteTags.tagId \
  group by Tags.tagId order by name');
const notebooks_query = db.prepare(
  'select name as name, Notebooks.notebookId as key, type as type, count(Notes.title) as notes \
  from Notebooks left join Notes on Notes.notebookId=key group by key order by name');
// db.connect

app.use(cookieParser())
app.use(sso)
app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/api/tags", (req, res) => {
  const tags = tag_query.all().map(r => {
    r.parent = r.parent || 0
    return r
  })
  res.json({tags: tags})
})

app.get("/api/notebooks", (req, res) => {
  let result = {notebooks: notebooks_query.all()}
  res.json(result)
})

app.get("/api/notebooks_and_tags", (req, res) => {
  const tags = tag_query.all().map(r => {
      r.parent = r.parent || 0
      return r
    })
  res.json({notebooks: notebooks_query.all(), tags: tags})
})

const add_notebook = db.prepare('insert into Notebooks (name) values (?)')

app.post('/api/notebooks/:name', (req, res) => {
  res.json(add_notebook.run(req.params.name))
})

const notes_by_notebook_query = db.prepare(
  'select n.noteId as id, createTime, title, \
  GROUP_CONCAT(a.fileName) as attachments, \
  MIN(a.mime) as mime, SUM(a.size) size from Notes n left join Attachments a on id = a.noteId \
  where notebookId = ? and createTime > ? group by id order by createTime desc limit ?')

app.get("/api/notebooks/:notebookId", (req, res) => {
  res.json({
    notes: notes_by_notebook_query.all(req.params.notebookId,
      req.query.lastItem, req.query.limit)
  })
})

const notes_by_tag_query = db.prepare(
  'select n.noteId as id, createTime, title, \
  GROUP_CONCAT(a.fileName) as attachments, \
  MIN(a.mime) as mime, SUM(a.size) size \
  from NoteTags nt, Notes n left join Attachments a on id = a.noteId \
  where nt.tagId = ? and nt.noteId = id and createTime > ? \
  group by id order by createTime desc limit ?')

app.get("/api/tags/:tagId", (req, res) => {
  res.json({
    notes: notes_by_tag_query.all(req.params.tagId, req.query.lastItem, req.query.limit)
  })
})

const notes_by_text_query = db.prepare(
  'select n.noteId as id, createTime, title, \
  GROUP_CONCAT(a.fileName) as attachments, \
  MIN(a.mime) as mime, SUM(a.size) size \
  from NoteTags nt, Notes n left join Attachments a on id = a.noteId \
  where (nt.tagId in (select tagId from Tags where name like ?) or title like ?) and nt.noteId = id and createTime > ? \
  group by id order by createTime desc limit ?')

app.get("/api/search",(req, res) => {
  let queryText = req.query.term ? ('%' + req.query.term + '%') : 'nonono!'
  res.json({notes: notes_by_text_query.all(queryText, queryText, req.query.lastItem, req.query.limit)})
})

const select_note = db.prepare(
  'select notebookId, title, createTime, \
  GROUP_CONCAT(t.name) tags, GROUP_CONCAT(t.tagId) tagIds \
  from Notes n left join NoteTags nt on n.noteId = nt.noteId left join Tags t on t.tagId=nt.tagId \
  where n.noteId = ?')


const select_attachments = db.prepare('select attachmentId as id, fileName, uniqueFileName \
from Attachments where noteId = ?')

app.get("/api/notes/:noteId", (req, res) => {
  res.json({
    ...select_note.get(req.params.noteId),
    attachments: select_attachments.all(req.params.noteId),
    parts: notes.parts(req.params.noteId)
  })
})

app.post("/api/notes/:noteId/split", (req, res) => {
  notes.splitNote(req.user_name!, +req.params.noteId).then(() => res.json('OK'))
})

app.get('/api/body/:noteId', (req, res) => {
    res.set('Content-Type', 'text/html')
    res.send(Buffer.from(notes.html(notes.body(req.params.noteId))))
})

app.use('/api/body/attachments', express.static(baseDir +'/attachments'))
app.use('/api/body/css', express.static('server/public/css'))
app.use('/api/body/js', express.static('server/public/js'))
app.use('/api/body/images', express.static('server/public/images'))

const update_note = db.prepare("update Notes set title = $title, createTime = $createTime, notebookId = $notebookId, updateTime = date('now'), updatedBy = $updatedBy where noteId = $noteId")

app.post('/api/notes/:noteId', (req, res) => {
  res.json(update_note.run({...req.params, ...req.body,
    updatedBy: req.user_name
  }))
})

const move_notes = sql_helper.prepare_many(db, "update Notes set notebookId = ?, updateTime = date('now'), updatedBy = ? where noteId in (#noteIds)", '#noteIds')
const find_notebook = db.prepare('select notebookId from Notebooks where type=?')

app.post('/api/notes/:noteIds/notebook/:notebookId', (req, res) => {
  let ids = req.params.noteIds.split(',')
  let notebookId =  req.params.notebookId
  if (isNaN(+req.params.notebookId)) {
    notebookId = find_notebook.get(req.params.notebookId).notebookId
  }
  res.json(move_notes(ids.length).run(
   notebookId, req.user_name, ...ids
  ))
})

const add_tag_to_note = db.prepare('insert into NoteTags (noteId, tagId) values ($noteId, $tagId)')

app.post('/api/notes/:noteId/addTag', (req, res) => {
  res.json(add_tag_to_note.run({...req.params, ...req.body}))
})

const remove_tag_from_note = db.prepare('delete from NoteTags where noteId=$noteId and tagId=$tagId')

app.delete('/api/notes/:noteId/tags/:tagId', (req, res) =>{
  res.json(remove_tag_from_note.run(req.params))
})

const add_new_tag = db.prepare('insert into Tags (name, isExpanded, parentId) values ($name, false, $parent)')

app.put('/api/tags/new', (req, res) => {
  let r = add_new_tag.run({parent: undefined, ...req.body})
  console.log(r)
  res.json({key: r.lastInsertRowid})
})

const update_tag = db.prepare('update Tags set name = $name, parentId = $parent where tagId = $tagId')

app.post('/api/tags/:tagId', (req, res) => {
  if (req.params.tagId === '-1') {
    res.json({key: add_new_tag.run(req.body).lastInsertRowid})
  } else {
    res.json(update_tag.run({...req.params, ...req.body}))
  }
})

const update_tag_expand = db.prepare('update Tags set isExpanded = $expanded where tagId = $tagId')

app.post('/api/tags/:tagId/expand', (req, res) => {
  res.json(update_tag_expand.run({...req.params, ...req.body}))
})

app.get('/api/user', (req, res) => {
    res.json({
      user_id: req.user_id,
      user_name: req.user_name
    })
  }
)

app.get('/api/logout', (req, res) => {
  console.log(req.cookies)
  for (const c in req.cookies)  {
    console.log('clearing cookie ' + c)
    res.clearCookie(c)
  }
  res.json('OK')
})

const delete_tag = db.prepare('delete from Tags where tagId = ?')
const empty_tag = db.prepare('delete from NoteTags where tagId = ?')
const move_child_tags_to_parent = db.prepare('update Tags set parentId = (select parentId from Tags where tagid=$tagId) where parentId = $tagId')

app.delete('/api/tags/:tagId', (req, res) => {
  empty_tag.run(req.params.tagId)
  move_child_tags_to_parent.run(req.params)
  res.json(delete_tag.run(req.params.tagId))
})

const delete_notebook = db.prepare('delete from Notebooks where notebookId = ?')
const empty_notebook = db.prepare("update Notes set notebookId = (select notebookId from Notebooks where Type = 'I') where notebookId = ?")

app.delete('/api/notebooks/:notebookId', (req, res) => {
  empty_notebook.run(req.params.notebookId)
  res.json(delete_notebook.run(req.params.notebookId))
})

new AddNotes(notes, att).listen(app)

new Gmail(notes, att).listen(app)

new Trash(db).listen(app)

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
