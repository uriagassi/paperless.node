import formidable from "formidable";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import md5 from "md5";
import { Express, RequestHandler } from "express";
import config from "config";
import { Notes } from "./Notes.js";
import { Attachment, Attachments } from "./Attachment.js";

export class AddNotes {
  private readonly importDir: string = config.get("paperless.importDir");
  private readonly attachmentsDir: string =
    config.get("paperless.baseDir") + "/attachments/";

  private att: Attachments;
  private notes: Notes;
  private csrfProtection: RequestHandler;

  constructor(notes: Notes, att: Attachments, csrfProtection: RequestHandler) {
    this.att = att;
    this.notes = notes;
    this.csrfProtection = csrfProtection;
  }

  listen(app: Express) {
    app.get("/api/files/checkStatus", (_req, res) => {
      res.json({ pending: this.pendingFileList().length });
    });

    app.get("/api/files/import", (req, res) => {
      for (const fileName of this.pendingFileList()) {
        this.importFromFile(
          path.join(this.importDir, fileName),
          fileName,
          req.user_name ?? ""
        );
      }
      res.json("OK");
    });

    app.post("/api/files/new", this.csrfProtection, (req, res) => {
      const form = new formidable.IncomingForm();
      form.parse(req, (_err, _fields, files) => {
        const newNote = files.newNote as formidable.File;
        this.importFromFile(
          newNote.filepath,
          newNote.originalFilename ?? path.basename(newNote.filepath),
          req.user_name ?? ""
        );
        res.json("OK");
      });
    });

    app.post("/api/notes/:toNote/merge", this.csrfProtection, (req, res) => {
      this.notes.mergeNotes(+req.params.toNote, req.body.notes, () => {
        res.json("OK");
      });
    });
  }

  pendingFileList() {
    return fs.readdirSync(this.importDir).filter((f) => {
      return (
        !f.startsWith(".") &&
        fs.lstatSync(path.join(this.importDir, f)).isFile()
      );
    });
  }

  importFromFile(fullName: string, basename: string, user: string) {
    const stats = fs.lstatSync(fullName);
    if (stats.isFile()) {
      const attachment: Attachment = {
        fileName: basename.replaceAll(/[/:" *?<>|&=;]+/g, "_"),
        mime: mime.lookup(basename) || "",
        hash: md5(fs.readFileSync(fullName)),
        size: stats.size,
      };
      console.log(attachment);
      const named = this.att.setUniqueFilename(attachment);
      fs.copyFileSync(
        fullName,
        path.join(this.attachmentsDir, named.uniqueFilename)
      );
      const newNote = {
        createTime: stats.ctime.toISOString().replace(/T.*/, ""),
        title: path.basename(basename.replaceAll(/_/g, " ".replace(/\..{3}$/, ""))),
        noteData: this.att.getHtmlForAttachment(named),
        updateBy: user,
      };
      this.notes.insertNote(newNote, [named], []);
      fs.unlinkSync(fullName);
      return "OK";
    }
  }
}
