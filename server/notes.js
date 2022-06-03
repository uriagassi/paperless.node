(function() {
  const att = require('./attachment')
  const add_note = "insert into Notes \
      (NotebookId, CreateTime, UpdateTime, Title, NoteData) values \
      ((select notebookId from Notebooks where Type = 'I'), $createTime, date('now'), $title, $noteData)"
  const get_auto_id = 'select last_insert_rowid() as id'

  module.exports.insertNote = (db, note, attachments, attachmentCallback) => {
    return new Promise((resolve, reject) => {
      db.run(add_note, note, (e) => {
        let last = undefined
        console.log(`adding ${attachments?.size}`)
        if (attachments) {
          db.get(get_auto_id, (e, r) => {
            console.log(`adding attachments to ${get_auto_id}`)
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


})()
