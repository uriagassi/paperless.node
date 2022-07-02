import path from "path";
import fs from "fs";
import {Express} from "express";
import {Database, Statement} from "better-sqlite3";
import config from 'config';

export class Trash {
  attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

  private readonly delete_tags_for_note: Statement<[number|string]>;
  private readonly select_attachments: Statement<[number|string]>;
  private readonly delete_attachments: Statement<[number|string]>;
  private readonly delete_note: Statement<[number|string]>;
  private readonly all_notes_in_trash: Statement<[]>;

  constructor(db: Database) {
    this.delete_tags_for_note = db.prepare('delete from NoteTags where noteId = ?');
    this.select_attachments = db.prepare('select uniqueFileName from Attachments where noteId = ?').raw();
    this.delete_attachments = db.prepare('delete from Attachments where noteId = ?');
    this.delete_note = db.prepare('delete from Notes where noteId = ?');
    this.all_notes_in_trash = db.prepare("select noteId from Notes where notebookId = (select notebookId from Notebooks where type = 'D')");
  }

  listen(app: Express) {
    app.delete('/api/notes/:noteId', (req, res) => {
      req.params.noteId.split(',').forEach(id => {
        this.deleteNote(id)
      })
      res.json({result: 'OK'})
    })

    app.delete('/api/trash', (req, res) => {
      const notes = this.all_notes_in_trash.all();
      notes.forEach(i => this.deleteNote(i.noteId))
      res.json({deleted: notes.length})
    })
  }

  deleteNote(noteId:number|string) {
    // 1. get attachments to delete
    const attachmentsToDelete  = this.select_attachments.all(noteId)
    // 2. delete attachments from db
    this.delete_attachments.run(noteId)
    // 3. delete tags
    this.delete_tags_for_note.run(noteId)
    // 4. delete note
    this.delete_note.run(noteId)
    // 5. delete attachments from fs
    attachmentsToDelete.forEach(a => {
      if (fs.existsSync(path.join(this.attachmentsDir, ...a))) {
        fs.unlinkSync(path.join(this.attachmentsDir, ...a))
      }
    })
  }

}
