(function () {
  const formidable = require("formidable");
  const path = require('path');
  const fs = require('fs');
  const mime = require('mime-types');
  const md5 = require('md5');

  module.exports.start = function (app, config, db, notes, att) {
    const importDir = config.get("paperless.importDir")
    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    app.get('/api/files/checkStatus', (req, res) => {
        res.json({pending: pendingFileList().length})
    })

    app.get('/api/files/import', (req, res) => {
      importFiles(pendingFileList(), 0, req, res)
    })

    app.post('/api/files/new', (req, res) => {
      const form = new formidable.IncomingForm();
      form.parse(req, (err, fields, files) => {
        importFromFile(files.newNote.filepath, files.newNote.originalFilename, req.user_name, 0).then(() => {
          res.json('OK')
        })
      })
    })

    app.post('/api/notes/:toNote/merge', (req, res) => {
      notes.mergeNotes( Number(req.params.toNote), req.body.notes, () => {
        res.json('OK')
      })
    })

    const pendingFileList = () => {
      return fs.readdirSync(importDir).filter(f => {
        return !f.startsWith('.') && fs.lstatSync(
          path.join(importDir, f)).isFile()
      })
    }

    const importFiles = (fileList, i, req, res) => {
      importFromFile(path.join(importDir, fileList[i]), fileList[i], req.user_name, i).then(() => {
        if (i < fileList.length - 1) {
          importFiles(fileList, i + 1, req, res)
        } else {
          res.json("OK")
        }
      })
    }

    const importFromFile = (fullName, basename, user, i) => {
      return new Promise((resolve, reject) => {
        console.log("starting " + i)
        let stats = fs.lstatSync(fullName)
        if (stats.isFile()) {
          let attachment = {
            fileName: basename.replaceAll(/[\/:" *?<>|&=;]+/g,
              '_'),
            mime: mime.lookup(basename),
            hash: md5(fs.readFileSync(fullName)),
            size: stats.size
          }
          console.log(attachment)
          att.setUniqueFilename(attachment, config)
          fs.copyFileSync(fullName, path.join(attachmentsDir, attachment.uniqueFilename))
          let newNote = {
            createTime: stats.ctime.toISOString().replace(/T.*/, ''),
            title: path.basename(attachment.fileName),
            noteData: att.getHtmlForAttachment(attachment),
            updateBy: user
          }
          notes.insertNote(newNote, [attachment], [], (e) => {
            console.log(e)
            fs.unlinkSync(fullName)
          }).then(() => resolve("OK"))
        }
      })
    }

  }

}());
