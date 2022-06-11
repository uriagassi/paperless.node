(function() {
  module.exports.prepare = (db) => {
    const sql_helper = require('./sql_helper')
    const result = {}
    const find_tag_by_name = db.prepare('select TagId as tagId from tags where name = ?')
    const add_tag_to_note = db.prepare('insert into notetags (noteid, tagid) values ($noteId, $tagId)')
    const add_tag = db.prepare('insert into Tags (Name, IsExpanded) values (?, false)')
    const delete_tags = sql_helper.prepare_many(db, 'delete from NoteTags where NoteId in (#noteIds)', '#noteIds')

    function addTagId(noteId, tagId, callback) {
      add_tag_to_note.run({noteId: noteId, tagId: tagId})
      callback?.(tagId)
    }

    result.addTagId = addTagId

    result.addTag = (noteId, tagName) => {
      return new Promise(resolve => {
        if (!tagName) resolve(undefined)
        const r = find_tag_by_name.get(tagName)
        if (r) {
          addTagId(noteId, r.tagId, resolve);
        } else {
          console.log('adding new tag...')
          const added_tag = add_tag.run(tagName)
          if (added_tag.changes > 0) {
            console.log('adding to note')
            add_tag_to_note.run(
              {noteId: noteId, tagId: added_tag.lastInsertRowid})
          }
          resolve(added_tag.lastInsertRowid)
        }
      })
    }

    result.removeTags = (noteIds) => {
      delete_tags(noteIds.length).run(noteIds)
    }
    return result
  }
})()
