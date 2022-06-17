(function () {
  const formidable = require("formidable");
  const path = require('path');
  const fs = require('fs');
  const mime = require('mime-types');
  const md5 = require('md5');

  module.exports.start = function (app, config, db, notes, att) {
    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    const delete_tags_for_note = db.prepare('delete from NoteTags where NoteId = ?')
    const select_attachments = db.prepare('select UniqueFileName from Attachments where NoteNodeId = ?').raw()
    const delete_attachments = db.prepare('delete from Attachments where NoteNodeId = ?')
    const delete_note = db.prepare('delete from Notes where NodeId = ?')

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
        fs.unlinkSync(path.join(attachmentsDir, ...a))
      })
    }

    app.delete('/api/notes/:noteId', (req, res) => {
      req.params.noteId.split(',').forEach(id => {
        deleteNote(id)
      })
      res.json({result: 'OK'})
    })

    const all_notes_in_trash = db.prepare("select NodeId from Notes where NotebookId = (select NotebookId from Notebooks where Type = 'D')")

    app.delete('/api/trash', (req, res) => {
      const notes = all_notes_in_trash.all();
      notes.forEach(i => deleteNote(i.NodeId))
      res.json({deleted: notes.length})
    })
  }
})()
