(function () {
  const formidable = require("formidable");
  const path = require('path');
  const fs = require('fs');
  const mime = require('mime-types');
  const md5 = require('md5');
  const att = require('./attachment')
  const notes = require('./notes')




  module.exports.start = function (app, config, db) {
    const importDir = config.get("paperless.importDir")
    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

    app.get('/api/files/checkStatus', (req, res) => {
        res.json({pending: pendingFileList().length})
    })

    app.get('/api/files/import', (req, res) => {
      importFiles(pendingFileList(), 0, res)
    })

    app.post('/api/files/new', (req, res) => {
      const form = new formidable.IncomingForm();
      form.parse(req, (err, fields, files) => {
        console.log(files.newNote)
        console.log(fields)
        importFromFile(files.newNote.filepath, files.newNote.originalFilename, 0).then(() => {
          res.json('OK')
        })
      })
    })

    const pendingFileList = () => {
      return fs.readdirSync(importDir).filter(f => {
        return !f.startsWith('.') && fs.lstatSync(
          path.join(importDir, f)).isFile()
      })
    }

    const importFiles = (fileList, i, res) => {
      importFromFile(path.join(importDir, fileList[i]), fileList[i], i).then(() => {
        if (i < fileList.length - 1) {
          importFiles(fileList, i + 1, res)
        } else {
          res.json("OK")
        }
      })
    }


    const add_attachment = db.prepare('insert into Attachments \
     (FileName, UniqueFilename, Mime, Hash, Size, NoteNodeId) values \
     ($fileName, $uniqueFilename, $mime, $hash, $size, $noteId)')




    const importFromFile = (fullName, basename, i) => {
      return new Promise((resolve, reject) => {
        console.log("starting " + i)
        let stats = fs.lstatSync(fullName)
        if (stats.isFile()) {
          let attachment = {
            $fileName: basename.replaceAll(/[\/:" *?<>|&=;]+/g,
              '_'),
            $mime: mime.lookup(basename),
            $hash: md5(fs.readFileSync(fullName)),
            $size: stats.size
          }
          console.log(attachment)
          att.setUniqueFilename(attachment, config)
          fs.copyFileSync(fullName, path.join(attachmentsDir, attachment.$uniqueFilename))
          let newNote = {
            $createTime: stats.ctime.toISOString().replace(/T.*/, ''),
            $title: path.parse(attachment.$fileName),
            $noteData: att.getHtmlForAttachment(attachment)
          }
          notes.insertNote(db, newNote, [attachment], [], (e) => {
            console.log(e)
            fs.unlinkSync(fullName)
          }).then(() => resolve("OK"))
        }
      })
    }

  }

}());
