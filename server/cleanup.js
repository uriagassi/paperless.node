(function () {
  const path = require('path');
  const fs = require('fs');

  module.exports.start = function (app, config, db) {
    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    const delete_tags_for_note = db.prepare('delete from NoteTags where noteId = ?')
    const select_attachments = db.prepare('select uniqueFileName from Attachments where noteId = ?').raw()
    const delete_attachments = db.prepare('delete from Attachments where noteId = ?')
    const delete_note = db.prepare('delete from Notes where noteId = ?')

    function deleteNote(noteId) {
      // 1. get attachments to delete
      const attachmentsToDelete  = select_attachments.all(noteId)
      console.log(attachmentsToDelete)
      // 2. delete attachments from db
      delete_attachments.run(noteId)
      // 3. delete tags
      delete_tags_for_note.run(noteId)
      // 4. delete note
      delete_note.run(noteId)
      // 5. delete attachments from fs
      attachmentsToDelete.forEach(a => {
        if (fs.existsSync(path.join(attachmentsDir, ...a))) {
          fs.unlinkSync(path.join(attachmentsDir, ...a))
        }
      })
    }

    app.delete('/api/notes/:noteId', (req, res) => {
      req.params.noteId.split(',').forEach(id => {
        deleteNote(id)
      })
      res.json({result: 'OK'})
    })

    const all_notes_in_trash = db.prepare("select noteId from Notes where notebookId = (select notebookId from Notebooks where type = 'D')")

    app.delete('/api/trash', (req, res) => {
      const notes = all_notes_in_trash.all();
      notes.forEach(i => deleteNote(i.noteId))
      res.json({deleted: notes.length})
    })
  }
})()
