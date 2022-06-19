// server/index.js

const express = require("express");
const bodyParser = require("body-parser");
const config = require('config')

const PORT = process.env.PORT || config.get('server.port');
const sqlite3 = require('better-sqlite3');
const baseDir = config.get('paperless.baseDir')
const db = new sqlite3(baseDir + '/paperless.sqlite', { verbose: console.log});
const app = express();
const sso = require(config.get('sso.handler'))
const cookieParser = require('cookie-parser')

const addNotes = require("./addNotes");
const gmail = require('./gmail')
const sql_helper = require('./sql_helper')
const cleanup = require('./cleanup')
const att = require('./attachment').prepare(db)
const tagservice = require('./tags').prepare(db)
const notes = require('./notes').prepare(db, att, tagservice)

const tag_query = db.prepare(
  'select name as name, tags.tagid as key, ifnull(parenttagtagid, 0) as parent, \
  isExpanded as isExpanded, count(notetags.tagid) as notes \
  from tags left join notetags on tags.tagid=notetags.tagid \
  group by tags.tagid order by name');
const notebooks_query = db.prepare(
  'select name as name, notebooks.notebookid as key, type as type, count(notes.title) as notes \
  from notebooks left join notes on notes.notebookid=key group by key order by name');
// db.connect

app.use(cookieParser())
app.use(sso)
app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/api/tags", (req, res) => {
  let result = {tags: []}
  tag_query.all().forEach(r => {
    r.parent = r.parent || 0
    result.tags.push(r);
  })
  res.json(result)
})

app.get("/api/notebooks", (req, res) => {
  let result = {notebooks: notebooks_query.all()}
  res.json(result)
})

app.get("/api/notebooks_and_tags", (req, res) => {
  let result = {notebooks: notebooks_query.all(), tags: []}

    tag_query.all().forEach(r => {
      r.parent = r.parent || 0
      result.tags.push(r);
    })
  res.json(result)
})

const add_notebook = db.prepare('insert into notebooks (name) values (?)')

app.post('/api/notebooks/:name', (req, res) => {
  res.json(add_notebook.run(req.params.name))
})

const notes_by_notebook_query = db.prepare(
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size from notes left join attachments a on NodeId = NoteNodeId \
  where NotebookId = ? and createTime > ? group by NodeId order by createTime desc limit ?')

app.get("/api/notebooks/:notebookId", (req, res) => {
  res.json({
    notes: notes_by_notebook_query.all(req.params.notebookId,
      req.query.lastItem, req.query.limit)
  })
})

const notes_by_tag_query = db.prepare(
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size \
  from NoteTags nt, notes left join attachments a on NodeId = NoteNodeId \
  where nt.TagId = ? and nt.NoteId = NodeId and createTime > ? \
  group by NodeId order by createTime desc limit ?')

app.get("/api/tags/:tagId", (req, res) => {
  res.json({
    notes: notes_by_tag_query.all(req.params.tagId, req.query.lastItem, req.query.limit)
  })
})

const notes_by_text_query = db.prepare(
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size \
  from NoteTags nt, notes left join attachments a on NodeId = NoteNodeId \
  where (nt.TagId in (select TagId from Tags where Name like ?) or title like ?) and nt.NoteId = NodeId and createTime > ? \
  group by NodeId order by createTime desc limit ?')

app.get("/api/search",(req, res) => {
  let queryText = req.query.term ? ('%' + req.query.term + '%') : 'nonono!'
  res.json({notes: notes_by_text_query.all(queryText, queryText, req.query.lastItem, req.query.limit)})
})

const select_note = db.prepare(
  'select NotebookId as notebookId, Title as title, CreateTime as createTime, \
  GROUP_CONCAT(t.Name) tags, GROUP_CONCAT(t.TagId) tagIds \
  from Notes left join NoteTags nt on NodeId = nt.NoteId left join Tags t on t.TagId=nt.TagId \
  where NodeId = ?')


const select_attachments = db.prepare('select AttachmentId as id, Filename as filename, UniqueFilename as uniqueFilename \
from Attachments where NoteNodeId = ?')

app.get("/api/notes/:noteId", (req, res) => {
  res.json({
    ...select_note.get(req.params.noteId),
    attachments: select_attachments.all(req.params.noteId),
    parts: notes.parts(req.params.noteId)
  })
})

app.post("/api/notes/:noteId/split", (req, res) => {
  notes.splitNote(req.user_name, req.params.noteId).then(_ => res.json('OK'))
})

app.get('/api/body/:noteId', (req, res) => {
    res.set('Content-Type', 'text/html')
    res.send(Buffer.from(notes.html(notes.body(req.params.noteId))))
})

app.use('/api/body/attachments', express.static(baseDir +'/attachments'))
app.use('/api/body/css', express.static('server/public/css'))
app.use('/api/body/js', express.static('server/public/js'))
app.use('/api/body/images', express.static('server/public/images'))

const update_note = db.prepare("update notes set title = $title, createTime = $createTime, notebookId = $notebookId, updateTime = date('now'), updatedBy = $updatedBy where NodeId = $noteId")

app.post('/api/notes/:noteId', (req, res) => {
  res.json(update_note.run({
    noteId: req.params.noteId,
    notebookId: req.body.notebookId,
    createTime: req.body.createTime,
    title: req.body.title,
    updatedBy: req.user_name
  }))
})

const move_notes = sql_helper.prepare_many(db, "update notes set notebookId = ?, updateTime = date('now'), updatedBy = ? where NodeId in (#noteIds)", '#noteIds')

app.post('/api/notes/:noteIds/notebook/:notebookId', (req, res) => {
  let ids = req.params.noteIds.split(',')
  res.json(move_notes(ids.length).run(
    req.params.notebookId, req.user_name, ...ids
  ))
})

const add_tag_to_note = db.prepare('insert into NoteTags (NoteId, TagId) values ($noteId, $tagId)')

app.post('/api/notes/:noteId/addTag', (req, res) => {
  res.json(add_tag_to_note.run({...req.params, ...req.body}))
})

const remove_tag_from_note = db.prepare('delete from NoteTags where NoteId=$noteId and TagId=$tagId')

app.delete('/api/notes/:noteId/tags/:tagId', (req, res) =>{
  res.json(remove_tag_from_note.run(req.params))
})

const add_new_tag = db.prepare('insert into Tags (Name, IsExpanded) values ($name, false)')

app.put('/api/tags/new', (req, res) => {
  let r = add_new_tag.run(req.body)
  console.log(r)
  res.json({key: r.lastInsertRowid})
})

const update_tag = db.prepare('update Tags set Name = $name, ParentTagTagId = $parent where TagId = $tagId')

app.post('/api/tags/:tagId', (req, res) => {
  res.json(update_tag.run({...req.params, ...req.body}))
})

const update_tag_expand = db.prepare('update Tags set IsExpanded = $expanded where TagId = $tagId')

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

const delete_tag = db.prepare('delete from tags where tagId = ?')
const empty_tag = db.prepare('delete from notetags where tagId = ?')
const move_child_tags_to_parent = db.prepare('update tags set parenttagtagid = (select parenttagtagid from tags where tagid=$tagId) where parenttagtagid = $tagId')

app.delete('/api/tags/:tagId', (req, res) => {
  empty_tag.run(req.params.tagId)
  move_child_tags_to_parent.run(req.params)
  res.json(delete_tag.run(req.params.tagId))
})

const delete_notebook = db.prepare('delete from notebooks where notebookId = ?')
const empty_notebook = db.prepare("update notes set notebookId = (select NotebookId from Notebooks where Type = 'I') where notebookId = ?")

app.delete('/api/notebooks/:notebookId', (req, res) => {
  empty_notebook.run(req.params.notebookId)
  res.json(delete_notebook.run(req.params.notebookId))
})

addNotes.start(app, config, db, notes, att)

gmail.start(app, config, notes, att)

cleanup.start(app, config, db, notes, att)

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
