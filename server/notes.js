(function() {
  const att = require('./attachment')
  const tagservice = require('./tags')

  const add_note = "insert into Notes \
      (NotebookId, CreateTime, UpdateTime, Title, NoteData, UpdatedBy) values \
      ((select notebookId from Notebooks where Type = 'I'), $createTime, date('now'), $title, $noteData, $updateBy)"
  const get_auto_id = 'select last_insert_rowid() as id'

  module.exports.insertNote = (db, note, attachments, tags, attachmentCallback) => {
    return new Promise((resolve, reject) => {
      db.run(add_note, note, (e) => {
        let last = undefined
        console.log(`adding ${attachments?.size}`)
        if (attachments || tags) {
          db.get(get_auto_id, (e, r) => {
            if (r.id != '0') {
              attachments.forEach(attachment => {
                if (last) {
                  last = last.then(() => att.addAttachment(db, attachment, r.id,
                    attachmentCallback))
                } else {
                  last = att.addAttachment(db, attachment, r.id,
                    attachmentCallback)
                }
              })
              tags.forEach(tag => {
                console.log(`adding ${tag}...`)
                console.log(last)
                if (last) {
                  last = last.then(() => tagservice.addTag(db, r.id, tag))
                } else {
                  last = tagservice.addTag(db, r.id, tag)
                }
              })
            } else {
              reject(e)
            }
          })
        }
        if (last) {
          last.then(() => resolve("OK"))
        } else {
          resolve("OK")
        }
      })
    })
  }

  const get_note_data = 'select Title, NoteData, CreateTime, GROUP_CONCAT(a.Hash) Hash, GROUP_CONCAT(t.Name) Tags\
        from Notes left join Attachments a on a.NoteNodeId = NodeId \
        left join NoteTags nt on NodeId = nt.NoteId left join Tags t on t.TagId=nt.TagId \
        where NodeId in (#noteIds) group by NodeId'

  const update_note_data = 'update Notes set NoteData = ? where NodeId = ?'

  const move_attachments_note = 'update Attachments set NoteNodeId = ? where NoteNodeId in (#noteIds)'
  const find_missing_tags = 'select TagId from NoteTags where NoteId \
    in (#noteIds) and TagId not in (select TagId from NoteTags where NoteId = ?)\
     group by TagId'
  const delete_notes = 'delete from Notes where nodeId in (#noteIds)'

  module.exports.mergeNotes = (db, toNote, notes, callback) => {
    if (notes.length < 2) return null;
    notes = notes.filter(n => n !== toNote)
    db.get(get_note_data.replace(/#noteIds/, "?"), toNote, (err, mainNote) => {
      let noteData = mainNote.NoteData
      db.each(get_note_data.replace(/#noteIds/, notes.map(() => '?').join(',')), notes, (err, note) => {
          noteData += `<div class='paperless-merged-note'>\
        <div class='paperless-merged-note-data'>\
        <div class='paperless-merged-note-title'>${note.Title}</div>\n`;
          if (note.Hash?.length > 0) {
            noteData += `<div class='paperless-merged-note-attachments' data='${note.Hash.replaceAll(/,/g, ' ')}'></div>`;
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
        }, () => {
        // update papa note
        db.run(update_note_data, noteData, toNote, () => {
          // move attachments
          db.run(move_attachments_note.replace(/#noteIds/, notes.map(() => '?').join(',')), [toNote, ...notes], () => {
            // add missing tags
            db.each(find_missing_tags.replace(/#noteIds/, notes.map(() => '?').join(',')), [...notes, toNote], (err, tagId) => {
              tagservice.addTagId(db, toNote, tagId.TagId)
            }, () => {
              //delete orphan tags
              tagservice.removeTags(db, notes, () => {
                //delete notes
                db.run(delete_notes.replace(/#noteIds/, notes.map(() => '?').join(',')), notes, () => {
                  callback(toNote)
                })
              })
            })
          })
        })
      })
      })
      return toNote;
    }


  })()
