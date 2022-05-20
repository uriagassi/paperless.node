// server/index.js

const express = require("express");

const PORT = process.env.PORT || 3001;
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/Volumes/MainBackup/Paperless/paperless.sqlite');
const app = express();
const tag_query = 'select name as name, tags.tagid as id, parenttagtagid as parent, \
  isExpanded as isExpanded, count(*) as notes \
  from tags left join notetags on tags.tagid=notetags.tagid \
  group by tags.tagid order by name';
const notebooks_query = 'select name as name, notebooks.notebookid as id, count(*) as notes from notebooks left join notes where notes.notebookid=id group by id order by name';
db.connect
app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.get("/api/tags", (req, res) => {
  let result = {tags: []}
  db.each(tag_query, (e, r) => {
    r.parent = r.parent || 0
    result.tags.push(r);
  }, (e, r) => res.json(result))

})

app.get("/api/notebooks", (req, res) => {
  let result = {notebooks: []}
  db.each(notebooks_query, (e, r) => {
    result.notebooks.push(r);
  }, (e, r) => res.json(result))
})

app.get("/api/notebooks_and_tags", (req, res) => {
  let result = {notebooks: [], tags: []}
  db.each(notebooks_query, (e, r) => {
    result.notebooks.push(r);
  }).each(tag_query, (e, r) => {
    r.parent = r.parent || 0
    result.tags.push(r);
  }, (e, r) => res.json(result))
})

const notes_by_notebook_query =
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size from notes left join attachments a on NodeId = NoteNodeId \
  where NotebookId = ? and createTime > ? group by NodeId order by createTime desc limit ?'

app.get("/api/notebooks/:notebookId/:limit/:lastItem", (req, res) => {
  let result = {notes: []}
  db.each(notes_by_notebook_query, req.params.notebookId, req.params.lastItem, req.params.limit, (e, r) => {
    if (e) {
      console.log(e)
    }
    result.notes.push(r)
  }, (e, r) => res.json(result))
})

const notes_by_tag_query =
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size \
  from NoteTags nt, notes left join attachments a on NodeId = NoteNodeId \
  where nt.TagId = ? and nt.NoteId = NodeId and createTime > ? \
  group by NodeId order by createTime desc limit ?'

app.get("/api/tags/:tagId/:limit/:lastItem", (req, res) => {
  let result = {notes: []}
  db.each(notes_by_tag_query, req.params.tagId, req.params.lastItem, req.params.limit, (e, r) => {
    result.notes.push(r)
  }, (e, r) => res.json(result))
})

const select_note =
  'select NotebookId as notebookId, Title as title, CreateTime as createTime, \
  GROUP_CONCAT(t.Name) tags, GROUP_CONCAT(t.TagId) tagIds \
  from Notes left join NoteTags nt on NodeId = nt.NoteId join Tags t on t.TagId=nt.TagId \
  where NodeId = ?'
;
app.get("/api/notes/:noteId", (req, res) => {
  db.get(select_note, req.params.noteId, (e, r) => res.json(r))
})

app.get('/api/body/:noteId', (req, res) => {
  db.get('select NoteData data from Notes where NodeId = ?', req.params.noteId, (e, r) => {
    res.set('Content-Type', 'text/html')
    res.send(Buffer.from('<html><head>' +
      "<link rel='stylesheet' type='text/css' href='css/paperless.css'/>" +
      "<meta http-equiv='X-UA-Compatible' content='IE=11'>" +
      "<script src='js/paperless.js'></script>" +
      "</head><body>" + r.data +
  '</body></html>'))
  })
})

app.use('/api/body/attachments', express.static('/Volumes/MainBackup/Paperless/attachments'))
app.use('/api/body/css', express.static('/Volumes/MainBackup/Paperless/css'))
app.use('/api/body/js', express.static('/Volumes/MainBackup/Paperless/js'))

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
