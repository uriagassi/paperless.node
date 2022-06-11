(function() {

  const find_tag_by_name = 'select TagId as tagId from tags where name = ?'
  const add_tag_to_note = 'insert into notetags (noteid, tagid) values ($noteId, $tagId)'
  const add_tag = 'insert into Tags (Name, IsExpanded) values (?, false)'
  const get_auto_id = 'select last_insert_rowid() as id'
  const delete_tags = 'delete from NoteTags where NoteId in (#noteIds)'

  function addTagId(db, noteId, tagId, callback) {
    db.run(add_tag_to_note, {$noteId: noteId, $tagId: tagId}, e => {
      callback?.(tagId)
    })
  }

  module.exports.addTagId = addTagId

  module.exports.addTag = (db, noteId, tagName) => {
    return new Promise(resolve => {
      if (!tagName) resolve(undefined)
      db.get(find_tag_by_name, [tagName], (e, r) => {
        if (r) {
          addTagId(db, noteId, r.tagId, resolve);
        } else {
          console.log('adding new tag...')
          db.run(add_tag, [tagName], e => {
            console.log(e)
            console.log(r)
            if (!e) {
              db.get(get_auto_id, (e, r) => {
                console.log('adding to note')
                db.run(add_tag_to_note, {$noteId: noteId, $tagId: r.id}, e => {
                  resolve(r.id)
                })
              })
            }
          })
        }
      })
    })
  }

  module.exports.removeTags = (db, noteIds, callback) => {
    db.run(delete_tags.replace(/#noteIds/, noteIds.map(() => '?').join(',')), noteIds, ids => {
      callback()
    })
  }

})()
