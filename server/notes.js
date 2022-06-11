(function() {
  const jsdom = require('jsdom')
  const { JSDOM } = jsdom
  const sql_helper = require('./sql_helper')
  module.exports.prepare = (db, att, tagservice) => {

    const add_note_to_inbox = db.prepare("insert into Notes \
      (NotebookId, CreateTime, UpdateTime, Title, NoteData, UpdatedBy) values \
      ((select notebookId from Notebooks where Type = 'I'), $createTime, date('now'), $title, $noteData, $updateBy)")
    const add_note = db.prepare("insert into Notes \
      (NotebookId, CreateTime, UpdateTime, Title, NoteData, UpdatedBy) values \
      ($notebookId, $createTime, date('now'), $title, $noteData, $updateBy)")
    //const get_auto_id = 'select last_insert_rowid() as id'
    const result = {}

    result.insertNote = (note, attachments, tags,
      attachmentCallback) => {
      return new Promise((resolve, reject) => {
        const new_note = add_note_to_inbox.run(note)
        console.log(`adding ${attachments?.size}`)
        if (attachments || tags) {
          if (new_note.changes != 0) {
            attachments.forEach(attachment => {
              att.addAttachment(attachment, new_note.lastInsertRowid,
                attachmentCallback)
            })
            tags.forEach(tag => {
              console.log(`adding ${tag}...`)

              last = tagservice.addTag(new_note.lastInsertRowid, tag)
            })
          } else {
            reject(new_note)
          }
        }
        resolve("OK")
      })
    }

    const get_note_data = sql_helper.prepare_many(db, 'select Title, NoteData, CreateTime, GROUP_CONCAT(a.Hash) Hash, GROUP_CONCAT(t.Name) Tags\
        from Notes left join Attachments a on a.NoteNodeId = NodeId \
        left join NoteTags nt on NodeId = nt.NoteId left join Tags t on t.TagId=nt.TagId \
        where NodeId in (#noteIds) group by NodeId', '#noteIds')

    const update_note_data = db.prepare('update Notes set NoteData = ? where NodeId = ?')

    const move_attachments_note = sql_helper.prepare_many(db, 'update Attachments set NoteNodeId = ? where NoteNodeId in (#noteIds)', '#noteIds')
    const find_missing_tags = sql_helper.prepare_many(db, 'select TagId from NoteTags where NoteId \
    in (#noteIds) and TagId not in (select TagId from NoteTags where NoteId = ?)\
     group by TagId', '#noteIds')
    const delete_notes = sql_helper.prepare_many(db, 'delete from Notes where nodeId in (#noteIds)', '#noteIds')

    result.mergeNotes = (toNote, notes, callback) => {
      if (notes.length < 2) return null;
      notes = notes.filter(n => n !== toNote)
      const mainNote = get_note_data(1).get(toNote)
      let noteData = mainNote.NoteData
      get_note_data(notes.length).all(notes).forEach(note => {
        noteData += `<div class='paperless-merged-note'>\
        <div class='paperless-merged-note-data'>\
        <div class='paperless-merged-note-title'>${note.Title}</div>\n`;
        if (note.Hash?.length > 0) {
          noteData += `<div class='paperless-merged-note-attachments' data='${note.Hash.replaceAll(
            /,/g, ' ')}'></div>`;
        }
        noteData += "<div class='paperless-merged-note-tags'>\n";
        note.Tags?.split(',').forEach(t => {
          noteData += `<div class='paperless-merged-note-tag'>${t}</div>\n`;
        })

        noteData += `</div>\
        <div class='paperless-merged-note-create-date'>${note.CreateTime}</div>\
        </div>\n`;
        if (note.NoteData != null) {
          noteData += `<div class='paperless-merged-note-contents'>\
          ${note.NoteData}\
          </div>`;
        }
        toNote.NoteData += "\n</div>";
      })
      // update papa note
      update_note_data.run(noteData, toNote)
      // move attachments
      move_attachments_note(notes.length).run(toNote, ...notes)
      // add missing tags
      find_missing_tags(notes.length).all(...notes, toNote).forEach(tagId =>
        tagservice.addTagId(toNote, tagId.TagId)
      )
      //delete orphan tags
      tagservice.removeTags(notes)
      //delete notes
      delete_notes(notes.length).run(notes)
      callback(toNote)

      return toNote;
    }

    function traverse(doc, tag, callback) {
      doc.getElementsByTagName(tag).forEach(
        div => callback(div.getAttribute("className"), div));
    }

    function isNullOrWhitespace(input) {
      return !input || !input.trim();
    }

    result.splitNote = async (db, updateBy, originalNoteId) => {
      db.get(get_note_data.replace(/#noteIds/, "?"), toNote,
        (err, originalNote) => {
          const {document} = new JSDOM(originalNote.NoteData)
          let splitDone = false;
          traverse(document, "div", (c, d) => {
            if (c === "paperless-merged-note") {
              const tags = []
              const newNote =
                {
                  notebookId: originalNote.NotebookId,
                  updateBy: updateBy
                }
              traverse(d, "div", (partType, part) => {
                switch (partType) {
                  case "paperless-merged-note-data":
                    traverse(part, "div", (dataType, data) => {
                      switch (dataType) {
                        case "paperless-merged-note-title":
                          newNote.$title = data.innerText;
                          break;
                        case "paperless-merged-note-attachments":
                          if (isNullOrWhitespace(
                            data.getAttribute("data"))) break;
                          const hashes = data.getAttribute("data").Split(' ');
                          newNote.attachments = hashes;
                          break;
                        case "paperless-merged-note-tags":
                          traverse(data, "div", (_, tag) => {
                            newNote.tags.push(tag.innerText);
                          });
                          break;
                        case "paperless-merged-note-create-date":
                          newNote.$createTime = data.innerText;
                          break;
                      }
                    });
                    break;
                  case "paperless-merged-note-contents":
                    newNote.$noteData = part.innerHtml;
                    break;
                }
              });

              d.outerHtml = "";
              splitDone = true;
            }
          });
          return splitDone;
        })
    }
    return result;
  }
})()
