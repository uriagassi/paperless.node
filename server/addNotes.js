(function () {
  const path = require('path');
  const fs = require('fs');
  const mime = require('mime-types');
  const md5 = require('md5');

  function formatFileSize(bytes,decimalPoint) {
    if(bytes == 0) return '0 Bytes';
    var k = 1000,
      dm = decimalPoint || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }


  module.exports.start = function (app, config, db) {
    const importDir = config.get("paperless.importDir")
    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    app.get('/api/files/checkStatus', (req, res) => {
        res.json({pending: pendingFileList().length})
    })

    app.get('/api/files/import', (req, res) => {
      pendingFileList().forEach((f) => importFromFile(path.join(importDir, f)))
      res.json('OK')
    })

    const pendingFileList = () => {
      return fs.readdirSync(importDir).filter(f => {
        console.log(path.join(importDir, f))
        console.log(fs.lstatSync(path.join(importDir, f)).isFile())
        return !f.startsWith('.') && fs.lstatSync(
          path.join(importDir, f)).isFile()
      })
    }

    const add_note = "insert into Notes \
      (NotebookId, CreateTime, UpdateTime, Title, NoteData) values \
      ((select notebookId from Notebooks where name = $notebookName), $createTime, date('now'), $title, $noteData)"

    const add_attachment = db.prepare('insert into Attachments \
     (FileName, UniqueFilename, Mime, Hash, Size, NoteNodeId) values \
     ($fileName, $uniqueFilename, $mime, $hash, $size, $noteId)')

    const get_auto_id = 'select last_insert_rowid() as id'

    const getHtmlForAttachment = (attachmentData) => {
        if (attachmentData.$mime.startsWith("image"))
        {
          return "<img class='paperless-attachment' src='attachments/" + attachmentData.$uniqueFilename + "' hash='" + attachmentData.$hash + "'/>";
        }
        else if (attachmentData.$mime.endsWith("pdf"))
        {
          return "<embed class='paperless-attachment' src='attachments/" + attachmentData.$uniqueFilename + "' type='" + attachmentData.$mime + "' hash='" + attachmentData.$hash + "'/>";
        }
        else
        {
          return "<div class='paperless-attachment-file' data-ext='" + mime.extension(attachmentData.$mime) + "'" +
            " data-src='attachments/" + attachmentData.$uniqueFilename + "'><span>&nbsp;</span><span>" + attachmentData.$fileName + "</span>\n" +
            "<span>" + formatFileSize(attachmentData.$size) + " </span></div>";
        }
    }

    const importFromFile = (fullName) =>
    {
      let stats = fs.lstatSync(fullName)
      if (stats.isFile()) {
        let attachment = {
          $fileName : path.basename(fullName).replaceAll(/[\/:" *?<>|&=;]+/g, '_'),
          $mime : mime.lookup(fullName),
          $hash : md5(fs.readFileSync(fullName)),
          $size : stats.size
        }
        console.log(attachment)
        let baseName = path.parse(attachment.$fileName).name;
        let uniqueFilename = attachment.$fileName
        let tick = 0;
        while (fs.existsSync(path.join(attachmentsDir, uniqueFilename))) {
          tick++;
          uniqueFilename = baseName + tick + path.extname(fullName)
        }
        fs.copyFileSync(fullName, path.join(attachmentsDir, uniqueFilename))
        attachment.$uniqueFilename = uniqueFilename
        let newNote = {
          $notebookName : config.get("paperless.defaultNotebook"),
          $createTime : stats.ctime.toISOString().replace(/T.*/, ''),
          $title: path.basename(fullName),
          $noteData: getHtmlForAttachment(attachment)
        }

        db.run(add_note, newNote, (e) => {
          console.log(e)
          db.get(get_auto_id, (e, r) => {
            if (r.id != '0') {
              attachment.$noteId = r.id;
              console.log(attachment)
              add_attachment.run(attachment, (e) => {
                console.log(e)
                fs.unlinkSync(fullName)
              })
            } else {
              console.log(e)
              console.log(r)
            }
          })

        });
      }

    }

  }

}());
