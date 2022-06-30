import formidable from "formidable";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import md5 from "md5";
import {Express} from "express";
import config from "config";
import {Notes} from "./Notes.js";
import {Attachment, Attachments} from "./Attachment.js";
import {Request, Response} from "express";

export class AddNotes {
  private readonly importDir: string = config.get("paperless.importDir");
  private readonly attachmentsDir: string = config.get('paperless.baseDir') + '/attachments/';

  private att: Attachments;
  private notes: Notes;

  constructor(notes: Notes, att: Attachments) {
    this.att = att
    this.notes = notes
  }

  listen(app: Express) {
    app.get('/api/files/checkStatus', (req, res) => {
      res.json({pending: this.pendingFileList().length})
    })

    app.get('/api/files/import', (req, res) => {
      this.importFiles(this.pendingFileList(), 0, req, res)
    })

    app.post('/api/files/new', (req, res) => {
      const form = new formidable.IncomingForm();
      form.parse(req, (err, fields, files) => {
        const newNote = files.newNote as formidable.File;
        this.importFromFile(newNote.filepath, newNote.originalFilename!, req.user_name!, 0).then(() => {
          res.json('OK')
        })
      })
    })

    app.post('/api/notes/:toNote/merge', (req, res) => {
      this.notes.mergeNotes(+req.params.toNote, req.body.notes, () => {
        res.json('OK')
      })
    })
  }

  pendingFileList() {
    return fs.readdirSync(this.importDir).filter(f => {
      return !f.startsWith('.') && fs.lstatSync(
          path.join(this.importDir, f)).isFile()
    })
  }

  importFiles(fileList: string[], i: number, req: Request, res: Response) {
    this.importFromFile(path.join(this.importDir, fileList[i]), fileList[i], req.user_name!, i).then(() => {
      if (i < fileList.length - 1) {
        this.importFiles(fileList, i + 1, req, res)
      } else {
        res.json("OK")
      }
    })
  }

  importFromFile(fullName: string , basename: string, user: string, i: number) {
      return new Promise((resolve, reject) => {
        console.log("starting " + i)
        let stats = fs.lstatSync(fullName)
        if (stats.isFile()) {
          let attachment:Attachment = {
            fileName: basename.replaceAll(/[\/:" *?<>|&=;]+/g,
              '_'),
            mime: mime.lookup(basename) as string,
            hash: md5(fs.readFileSync(fullName)),
            size: stats.size
          }
          console.log(attachment)
          this.att.setUniqueFilename(attachment)
          fs.copyFileSync(fullName, path.join(this.attachmentsDir, attachment.uniqueFilename!))
          let newNote = {
            createTime: stats.ctime.toISOString().replace(/T.*/, ''),
            title: path.basename(attachment.fileName),
            noteData: this.att.getHtmlForAttachment(attachment),
            updateBy: user
          }
          this.notes.insertNote(newNote, [attachment], [], (e) => {
            console.log(e)
            fs.unlinkSync(fullName)
          }).then(() => resolve("OK"))
        }
      })
    }

}
