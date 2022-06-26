(function() {
  const jsdom = require('jsdom')
  const { JSDOM } = jsdom
  const sql_helper = require('./sql_helper')
  module.exports.prepare = (db, att, tagservice) => {

    const add_note_to_inbox = db.prepare("insert into Notes \
      (notebookId, createTime, updateTime, title, noteData, updatedBy) values \
      ((select notebookId from Notebooks where Type = 'I'), $createTime, date('now'), $title, $noteData, $updateBy)")
    const add_note = db.prepare("insert into Notes \
      (notebookId, createTime, updateTime, title, noteData, updatedBy) values \
      ($notebookId, $createTime, date('now'), $title, $noteData, $updateBy)")
    //const get_auto_id = 'select last_insert_rowid() as id'
    const result = {}

    result.insertNote = (note, attachments, tags,
      attachmentCallback) => {
      return new Promise((resolve, reject) => {
        const new_note = note.notebookId ? add_note.run(note) : add_note_to_inbox.run(note)
        console.log(`adding ${attachments?.size}`)
        if (attachments || tags) {
          if (new_note.changes !== 0) {
            attachments.forEach(attachment => {
              att.addAttachment(attachment, new_note.lastInsertRowid,
                attachmentCallback)
            })
            tags.forEach(tag => {
              console.log(`adding ${tag}...`)

              tagservice.addTag(new_note.lastInsertRowid, tag)
            })
          } else {
            reject(new_note)
          }
        }
        resolve("OK")
      })
    }

    const get_note_data = sql_helper.prepare_many(db, 'select title, noteData, createTime, notebookId, GROUP_CONCAT(a.hash) hashes, GROUP_CONCAT(t.name) tags\
        from Notes n left join Attachments a on a.noteId = n.noteId \
        left join NoteTags nt on n.noteId = nt.noteId left join Tags t on t.tagId=nt.tagId \
        where n.noteId in (#noteIds) group by n.noteId', '#noteIds')

    const update_note_data = db.prepare('update Notes set noteData = ? where noteId = ?')

    const move_attachments_note = sql_helper.prepare_many(db, 'update Attachments set noteId = ? where noteId in (#noteIds)', '#noteIds')
    const find_missing_tags = sql_helper.prepare_many(db, 'select tagId from NoteTags where noteId \
    in (#noteIds) and tagId not in (select tagId from NoteTags where noteId = ?)\
     group by tagId', '#noteIds')
    const delete_notes = sql_helper.prepare_many(db, 'delete from Notes where noteId in (#noteIds)', '#noteIds')

    result.mergeNotes = (toNote, notes, callback) => {
      if (notes.length < 2) return null;
      notes = notes.filter(n => n !== toNote)
      const mainNote = get_note_data(1).get(toNote)
      let noteData = mainNote.noteData
      get_note_data(notes.length).all(notes).forEach(note => {
        noteData += `<div class='paperless-merged-note'>
        <div class='paperless-merged-note-data'>
        <div class='paperless-merged-note-title'>${note.title}</div>\n`;
        if (note.hashes?.length > 0) {
          noteData += `<div class='paperless-merged-note-attachments' data='${note.hashes.replaceAll(
            /,/g, ' ')}'></div>`;
        }
        noteData += "<div class='paperless-merged-note-tags'>\n";
        note.tags?.split(',').forEach(t => {
          noteData += `<div class='paperless-merged-note-tag'>${t}</div>\n`;
        })

        noteData += `</div>
        <div class='paperless-merged-note-create-date'>${note.createTime}</div>
        </div>\n`;
        if (note.noteData != null) {
          noteData += `<div class='paperless-merged-note-contents'>
          ${note.noteData}
          </div>`;
        }
        toNote.noteData += "\n</div>";
      })
      // update papa note
      update_note_data.run(noteData, toNote)
      // move attachments
      move_attachments_note(notes.length).run(toNote, ...notes)
      // add missing tags
      find_missing_tags(notes.length).all(...notes, toNote).forEach(tagId =>
        tagservice.addTagId(toNote, tagId.tagId)
      )
      //delete orphan tags
      tagservice.removeTags(notes)
      //delete notes
      delete_notes(notes.length).run(notes)
      callback(toNote)

      return toNote;
    }

    function isNullOrWhitespace(input) {
      return !input || !input.trim();
    }

    const select_body = db.prepare('select noteData data from Notes where noteId = ?').raw(true)

    result.body = (noteId) => {
      return select_body.get(noteId)?.[0]
    }

    result.html = (body) => {
      return`\
<html>
  <head>
    <link rel='stylesheet' type='text/css' href='css/paperless.css'/>
    <meta http-equiv='X-UA-Compatible' content='IE=11'>
    <script src='js/paperless.js'></script>
  </head>
    <body>${body}</body>
</html>`
    }

    const count_parts = db.prepare("select length(replace(noteData, 'paperless-merged-note-data', 'paperless-merged-note-data1')) - length(noteData) as parts from Notes where noteId = ?").raw(true)

    result.parts = (noteId) => {
      return count_parts.get(noteId)[0]
    }

    result.splitNote = async (updateBy, originalNoteId) => {
      const originalNote = get_note_data(1).get(originalNoteId)
      const jsdom1 = new JSDOM(result.html(originalNote.noteData));
      const document = jsdom1.window.document.body
      let splitDone = false;
      document.querySelectorAll('.paperless-merged-note').forEach(d => {
        const tags = []
        const newNote =
          {
            notebookId: originalNote.notebookId,
            updateBy: updateBy
          }
        const attachments = []
        d.childNodes.forEach(part => {
          switch (part.className) {
            case "paperless-merged-note-data":
              part.childNodes.forEach(data => {
                switch (data.className) {
                  case "paperless-merged-note-title":
                    newNote.title = data.textContent;
                    break;
                  case "paperless-merged-note-attachments":
                    if (isNullOrWhitespace(
                      data.getAttribute("data"))) break;
                    const hashes = data.getAttribute("data").split(' ');
                    attachments.push(...hashes.map(h => { return {hash: h, noteId: originalNoteId} }));
                    break;
                  case "paperless-merged-note-tags":
                    data.childNodes.forEach(tag => {
                      if (!isNullOrWhitespace(tag.textContent)) {
                        tags.push(tag.textContent);
                      }
                    });
                    break;
                  case "paperless-merged-note-create-date":
                    newNote.createTime = data.textContent;
                    break;
                }
              });
              break;
            case "paperless-merged-note-contents":
              newNote.noteData = part.innerHTML;
              break;
          }
        });
        result.insertNote(newNote, attachments, tags)
        d.outerHTML = "";
        splitDone = true;
      });
      if (splitDone) {
        update_note_data.run(document.innerHTML, originalNoteId)
      }
      return splitDone;
    }
    return result;
  }
})()
