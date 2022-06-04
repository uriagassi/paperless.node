(function() {

  const find_tag_by_name = 'select TagId as tagId from tags where name = ?'
  const add_tag_to_note = 'insert into notetags (noteid, tagid) values ($noteId, $tagId)'
  const add_tag = 'insert into Tags (Name, IsExpanded) values (?, false)'
  const get_auto_id = 'select last_insert_rowid() as id'

  module.exports.addTag = (db, noteId, tagName) => {
    return new Promise(resole => {
      if (!tagName) resole(undefined)
      db.get(find_tag_by_name, [tagName], (e, r) => {
        if (r) {
          db.run(add_tag_to_note, { $noteId: noteId, $tagId: r.tagId}, e => {
            resole(r.tagId)
          })
        } else {
          console.log('adding new tag...')
          db.run(add_tag, [tagName], e => {
            console.log(e)
            console.log(r)
            if (!e) {
              db.get(get_auto_id, (e, r) => {
                console.log('adding to note')
                db.run(add_tag_to_note, {$noteId: noteId, $tagId: r.id}, e => {
                  resole(r.id)
                })
              })
            }
          })
        }
      })
    })
  }


})()
