import  { JSDOM } from "jsdom";

import {sql_helper} from "./sql_helper.js";
import {Database, RunResult, Statement} from "better-sqlite3";
import {Attachment, Attachments, ExistingAttachment} from "./Attachment.js";
import {Tags} from "./Tags.js";

export class Notes {
  private readonly add_note_to_inbox: Statement<Note>;
  private readonly add_note: Statement<Note>;
  private readonly get_note_data: (i: number) => Statement;
  private readonly update_note_data: Statement<[string, number | bigint]>;
  private readonly move_attachments_note: (i: number) => Statement<(number|bigint)[]>;
  private readonly find_missing_tags: (i: number) => Statement<(number|bigint)[]>;
  private readonly delete_notes: (i: number) => Statement<(number|bigint)[]>;
  private readonly select_body: Statement<[number|bigint|string]>;
  private readonly count_parts: Statement<[number|bigint|string]>;

  private readonly tagService: Tags;
  private readonly att: Attachments;

  constructor(db: Database, att: Attachments, tagService: Tags) {

    this.add_note_to_inbox = db.prepare("insert into Notes \
      (notebookId, createTime, updateTime, title, noteData, updatedBy) values \
      ((select notebookId from Notebooks where Type = 'I'), $createTime, date('now'), $title, $noteData, $updateBy)");

    this.add_note = db.prepare("insert into Notes \
      (notebookId, createTime, updateTime, title, noteData, updatedBy) values \
      ($notebookId, $createTime, date('now'), $title, $noteData, $updateBy)");

    this.get_note_data = sql_helper.prepare_many(db, 'select title, noteData, createTime, notebookId, GROUP_CONCAT(a.hash) hashes, GROUP_CONCAT(t.name) tags\
        from Notes n left join Attachments a on a.noteId = n.noteId \
        left join NoteTags nt on n.noteId = nt.noteId left join Tags t on t.tagId=nt.tagId \
        where n.noteId in (#noteIds) group by n.noteId', '#noteIds');

    this.select_body = db.prepare('select noteData from Notes where noteId = ?').raw();

    this.update_note_data = db.prepare('update Notes set noteData = ? where noteId = ?');

    this.move_attachments_note = sql_helper.prepare_many(db, 'update Attachments set noteId = ? where noteId in (#noteIds)', '#noteIds');

    this.find_missing_tags = sql_helper.prepare_many(db, 'select tagId from NoteTags where noteId \
    in (#noteIds) and tagId not in (select tagId from NoteTags where noteId = ?)\
     group by tagId', '#noteIds');

    this.delete_notes = sql_helper.prepare_many(db, 'delete from Notes where noteId in (#noteIds)', '#noteIds');

    this.count_parts = db.prepare("select length(replace(noteData, 'paperless-merged-note-data', 'paperless-merged-note-data1')) - length(noteData) as parts from Notes where noteId = ?").raw(true);

    this.tagService = tagService;
    this.att = att;
  }

  insertNote(note: Note, attachments?: (ExistingAttachment|Attachment)[], tags?: string[], attachmentCallback?: (att: RunResult) => any) {
      return new Promise((resolve, reject) => {
        const new_note = note.notebookId ? this.add_note.run(note) : this.add_note_to_inbox.run(note)
        console.log(`adding ${attachments?.length}`)
        if (attachments || tags) {
          if (new_note.changes !== 0) {
            attachments?.forEach(attachment => {
              this.att.addAttachment(attachment, new_note.lastInsertRowid,
                attachmentCallback)
            })
            tags?.forEach(tag => {
              console.log(`adding ${tag}...`)

              this.tagService.addTag(new_note.lastInsertRowid, tag)
            })
          } else {
            reject(new_note)
          }
        }
        resolve("OK")
      })
    }



    mergeNotes(toNote:number|bigint, notes:(number|bigint)[], callback: (toNote:number|bigint) => any) {
      if (notes.length < 2) return null;
      notes = notes.filter(n => n !== toNote)
      const mainNote = this.get_note_data(1).get(toNote)
      let noteData = mainNote.noteData
      this.get_note_data(notes.length).all(notes).forEach(note => {
        noteData += `<div class='paperless-merged-note'>
        <div class='paperless-merged-note-data'>
        <div class='paperless-merged-note-title'>${note.title}</div>\n`;
        if (note.hashes?.length > 0) {
          noteData += `<div class='paperless-merged-note-attachments' data='${note.hashes.replaceAll(
            /,/g, ' ')}'></div>`;
        }
        noteData += "<div class='paperless-merged-note-tags'>\n";
        note.tags?.split(',').forEach((t:string) => {
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
        noteData += "\n</div>";
      })
      // update papa note
      this.update_note_data.run(noteData, toNote)
      // move attachments
      this.move_attachments_note(notes.length).run(toNote, ...notes)
      // add missing tags
      this.find_missing_tags(notes.length).all(...notes, toNote).forEach(tagId =>
        this.tagService.addTagId(toNote, tagId.tagId)
      )
      //delete orphan tags
      this.tagService.removeTags(notes)
      //delete notes
      this.delete_notes(notes.length).run(...notes)
      callback(toNote)

      return toNote;
    }

    isNullOrWhitespace(input?:string|null):boolean {
      return !input || !input.trim();
    }


    body(noteId:number|bigint|string) {
      return this.select_body.get(noteId)?.[0]
    }

    html(body:string) {
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


    parts(noteId:number|bigint|string) {
      return this.count_parts.get(noteId)[0]
    }

    async splitNote(updateBy:string, originalNoteId:number|bigint) {
      const originalNote = this.get_note_data(1).get(originalNoteId)
      const jsdom1 = new JSDOM(this.html(originalNote.noteData));
      const document = jsdom1.window.document.body
      let splitDone = false;
      document.querySelectorAll('.paperless-merged-note').forEach(d => {
        const tags:string[] = []
        const newNote:Note =
          {
            title: '',
            notebookId: originalNote.notebookId,
            updateBy: updateBy,
            createTime: '',
            noteData: ''
          }
        const attachments:ExistingAttachment[] = []
        d.childNodes.forEach((partNode) => {
          const part = partNode as Element
          switch (part.className) {
            case "paperless-merged-note-data":
              part.childNodes.forEach(dataNode => {
                const data = dataNode as Element
                switch (data.className) {
                  case "paperless-merged-note-title":
                    newNote.title = data.textContent || '';
                    break;
                  case "paperless-merged-note-attachments":
                    if (this.isNullOrWhitespace(
                      data.getAttribute("data"))) break;
                    const hashes = data.getAttribute("data")!.split(' ');
                    attachments.push(...hashes.map((h:string) => { return {hash: h, noteId: originalNoteId} }));
                    break;
                  case "paperless-merged-note-tags":
                    data.childNodes.forEach(tag => {
                      if (!this.isNullOrWhitespace(tag.textContent)) {
                        tags.push(tag.textContent!);
                      }
                    });
                    break;
                  case "paperless-merged-note-create-date":
                    newNote.createTime = data.textContent!;
                    break;
                }
              });
              break;
            case "paperless-merged-note-contents":
              newNote.noteData = part.innerHTML;
              break;
          }
        });
        this.insertNote(newNote, attachments, tags)
        d.outerHTML = "";
        splitDone = true;
      });
      if (splitDone) {
        this.update_note_data.run(document.innerHTML, originalNoteId)
      }
      return splitDone;
    }
}

export interface Note {
 notebookId?: number;
 createTime: string;
 title: string;
 noteData: string;
 updateBy: string;
}
