// server/index.js

const express = require("express");
const bodyParser = require("body-parser");
const config = require('config')

const PORT = process.env.PORT || config.get('server.port');
const sqlite3 = require('sqlite3').verbose();
const baseDir = config.get('paperless.baseDir')
const db = new sqlite3.Database(baseDir + '/paperless.sqlite');
const app = express();
const sso = require(config.get('sso.handler'))
const cookieParser = require('cookie-parser')

const addNotes = require("./addNotes");
const gmail = require('./gmail')

db.on('trace', (e) => console.log(e))

const tag_query =
  'select name as name, tags.tagid as key, ifnull(parenttagtagid, 0) as parent, \
  isExpanded as isExpanded, count(notetags.tagid) as notes \
  from tags left join notetags on tags.tagid=notetags.tagid \
  group by tags.tagid order by name';
const notebooks_query =
  'select name as name, notebooks.notebookid as key, type as type, count(*) as notes \
  from notebooks left join notes where notes.notebookid=key group by key order by type="D", name\
';
db.connect

app.use(cookieParser())
app.use(sso)
app.get("/api", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

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
  }, () => {
    db.each(tag_query, (e, r) => {
      r.parent = r.parent || 0
      result.tags.push(r);
    }, (e, r) => res.json(result))
  })
})

const notes_by_notebook_query =
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size from notes left join attachments a on NodeId = NoteNodeId \
  where NotebookId = ? and createTime > ? group by NodeId order by createTime desc limit ?'

app.get("/api/notebooks/:notebookId", (req, res) => {
  let result = {notes: []}
  db.each(notes_by_notebook_query, req.params.notebookId, req.query.lastItem, req.query.limit, (e, r) => {
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

app.get("/api/tags/:tagId", (req, res) => {
  let result = {notes: []}
  db.each(notes_by_tag_query, req.params.tagId, req.query.lastItem, req.query.limit, (e, r) => {
    result.notes.push(r)
  }, (e, r) => res.json(result))
})

const notes_by_text_query =
  'select NodeId as id, CreateTime as createTime, Title as title, \
  GROUP_CONCAT(a.FileName) as attachments, \
  MIN(a.Mime) as mime, SUM(a.Size) size \
  from NoteTags nt, notes left join attachments a on NodeId = NoteNodeId \
  where (nt.TagId in (select TagId from Tags where Name like ?) or title like ?) and nt.NoteId = NodeId and createTime > ? \
  group by NodeId order by createTime desc limit ?'

app.get("/api/search",(req, res) => {
  let result = {notes: []}
  let queryText = req.query.term ? ('%' + req.query.term + '%') : 'nonono!'
  db.each(notes_by_text_query, queryText, queryText, req.query.lastItem, req.query.limit, (e, r) => {
    result.notes.push(r)
  }, (e, r) => {
    res.json(result)
  })
})

const select_note =
  'select NotebookId as notebookId, Title as title, CreateTime as createTime, \
  GROUP_CONCAT(t.Name) tags, GROUP_CONCAT(t.TagId) tagIds \
  from Notes left join NoteTags nt on NodeId = nt.NoteId left join Tags t on t.TagId=nt.TagId \
  where NodeId = ?'
;
app.get("/api/notes/:noteId", (req, res) => {
  db.get(select_note, req.params.noteId, (e, r) => {
    res.json(r)
  })
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

app.use('/api/body/attachments', express.static(baseDir +'/attachments'))
app.use('/api/body/css', express.static(baseDir + '/css'))
app.use('/api/body/js', express.static(baseDir + '/js'))
app.use('/api/body/images', express.static(baseDir + '/images'))

const update_note = "update notes set title = $title, createTime = $createTime, notebookId = $notebookId, updateTime = date('now') where NodeId = $noteId"

app.post('/api/notes/:noteId', (req, res) => {
  db.run(update_note, {
    $noteId: req.params.noteId,
    $notebookId: req.body.notebookId,
    $createTime: req.body.createTime,
    $title: req.body.title
  }, (e) => res.json(e ?? 'OK'))
})

const delete_note = 'update notes set notebookId = (select notebookId from notebooks where Type = "D") where NodeId = $noteId'
const delete_notes = 'update notes set notebookId = (select notebookId from notebooks where Type = "D") where NodeId in (#noteIds)'

app.delete('/api/notes/:noteId', (req, res) => {
  if (req.params.noteId.includes(',')) {
    let ids = req.params.noteId.split(',')
    db.run(delete_notes.replace(/#noteIds/, ids.map(() => '?').join(',')), ids
      , e => res.json(e ?? 'OK'))
  } else {
    db.run(delete_note, {
      $noteId: req.params.noteId
    }, (e) => res.json(e ?? 'OK'))
  }
})

const move_notes = "update notes set notebookId = ?, updateTime = date('now') where NodeId in (#noteIds)"

app.post('/api/notes/:noteIds/notebook/:notebookId', (req, res) => {
  let ids = req.params.noteIds.split(',')
  db.run(move_notes.replace(/#noteIds/, ids.map(() => '?').join(',')), [
    req.params.notebookId, ...ids
  ], e => res.json(e ?? 'OK'))
})

const add_tag_to_note = 'insert into NoteTags (NoteId, TagId) values ($noteId, $tagId)'

app.post('/api/notes/:noteId/addTag', (req, res) => {
  db.run(add_tag_to_note, {
    $noteId: req.params.noteId,
    $tagId: req.body.tagId
  }, (e) => res.json(e ?? 'OK'))
})

const remove_tag_from_note = 'delete from NoteTags where NoteId=$noteId and TagId=$tagId'

app.delete('/api/notes/:noteId/tags/:tagId', (req, res) =>{
  db.run(remove_tag_from_note, {
    $noteId: req.params.noteId,
    $tagId: req.params.tagId
  }, (e) => res.json(e ?? 'OK'))
})

const add_new_tag = 'insert into Tags (Name, IsExpanded) values ($name, false)'
const get_new_tag_id = 'select last_insert_rowid() as key'

app.put('/api/tags/new', (req, res) => {
  db.run(add_new_tag, { $name: req.body.name }, (e) => {
    console.log(e)
      db.get(get_new_tag_id, (e, r) => {
        console.log(e)
        console.log(r)
        res.json(r)
    })
    }
  )
})

const update_tag = 'update Tags set Name = $name, ParentTagTagId = $parent where TagId = $tagId'

app.post('/api/tags/:tagId', (req, res) => {
  db.run(update_tag, {
    $tagId: req.params.tagId,
    $name: req.body.name,
    $parent: req.body.parent
  }, (e) => {
    res.json(e ?? 'OK')
  })
})

const update_tag_expand = 'update Tags set IsExpanded = $expanded where TagId = $tagId'

app.post('/api/tags/:tagId/expand', (req, res) => {
  console.log(req.body)
  console.log(req.body.expanded)
  db.run(update_tag_expand, {
    $tagId: req.params.tagId,
    $expanded: req.body.expanded
  })
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

addNotes.start(app, config, db)

gmail.start(app, config, db)

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
