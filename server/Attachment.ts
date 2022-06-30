import fs from "fs";
import path from "path";
import mime from "mime-types";
import {Database, RunResult, Statement} from "better-sqlite3";
import config from "config";

export class Attachments {
  private add_attachment: Statement<[Attachment, number|bigint]>;
  private move_attachment: Statement<[number|bigint, ExistingAttachment]>;


  formatFileSize(bytes: number,decimalPoint?:number) {
    if(bytes === 0) return '0 Bytes';
    const k = 1000,
      dm = decimalPoint || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  constructor(db : Database) {
    this.add_attachment = db.prepare('insert into Attachments \
     (fileName, uniqueFilename, mime, hash, size, noteId) values \
     ($fileName, $uniqueFilename, $mime, $hash, $size, ?)')
    this.move_attachment = db.prepare('update attachments set noteId = ? where hash = $hash and noteId = $noteId')
  }

  getHtmlForAttachment(attachmentData : Attachment) {
      if (attachmentData.mime.startsWith("image")) {
        return `<img class='paperless-attachment' src='attachments/${attachmentData.uniqueFilename}' alt='${attachmentData.fileName}' hash='${attachmentData.hash}'/>`;
      } else if (attachmentData.mime.endsWith("pdf")) {
        return "<embed class='paperless-attachment' src='attachments/"
          + attachmentData.uniqueFilename + "' type='" + attachmentData.mime
          + "' hash='" + attachmentData.hash + "'/>";
      } else {
        return "<div class='paperless-attachment-file' data-ext='"
          + mime.extension(attachmentData.mime) + "'" +
          " data-src='attachments/" + attachmentData.uniqueFilename
          + "'><span>&nbsp;</span><span>" + attachmentData.fileName
          + "</span>\n" +
          "<span>" + this.formatFileSize(attachmentData.size) + " </span></div>";
      }
    }

    setUniqueFilename(attachment : Attachment) {
      const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'
      let noExtension = path.parse(attachment.fileName).name;
      let extension = path.extname(attachment.fileName);
      let uniqueFilename = attachment.fileName
      let tick = 0;
      while (fs.existsSync(path.join(attachmentsDir, uniqueFilename))) {
        tick++;
        uniqueFilename = noExtension + '_' + tick + extension;
      }
      attachment.uniqueFilename = uniqueFilename
    }

    addAttachment(attachment:Attachment|ExistingAttachment, noteId:number | bigint, callback?: (att:RunResult) => any) {
      if ("noteId" in attachment) {
        console.log(`moving attachment ${attachment.hash} from ${attachment.noteId} to ${noteId}`)
        this.move_attachment.run(noteId, attachment)
      } else {
        console.log(`adding attachment ${attachment.fileName} to ${noteId}`)
        const att = this.add_attachment.run(attachment, noteId);
        callback?.(att)
      }
    }
}

export interface ExistingAttachment {
  noteId: number|bigint;
  hash: string;
}

export interface Attachment {
  size: number;
  hash: string;
  fileName: string;
  uniqueFilename?: string;
  mime: string;
}
