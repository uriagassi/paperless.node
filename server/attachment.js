
(function() {
  const fs = require('fs');
  const path = require('path')
  const mime = require('mime-types')

  function formatFileSize(bytes,decimalPoint) {
    if(bytes == 0) return '0 Bytes';
    var k = 1000,
      dm = decimalPoint || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const add_attachment = 'insert into Attachments \
     (FileName, UniqueFilename, Mime, Hash, Size, NoteNodeId) values \
     ($fileName, $uniqueFilename, $mime, $hash, $size, $noteId)'
  module.exports.getHtmlForAttachment = (attachmentData) => {
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

  module.exports.setUniqueFilename = (attachment, config) => {
    const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'
    let noExtension = path.parse(attachment.$fileName).name;
    let extension = path.extname(attachment.$fileName);
    let uniqueFilename = attachment.$fileName
    let tick = 0;
    while (fs.existsSync(path.join(attachmentsDir, uniqueFilename))) {
      tick++;
      uniqueFilename = noExtension + '_' + tick + extension;
    }
    attachment.$uniqueFilename = uniqueFilename
  }

  module.exports.addAttachment = (db, attachment, noteId, callback) => {
    console.log(`adding attachment ${attachment.$fileName} to ${noteId}`)
    attachment.$noteId = noteId;
    return new Promise(resolve => {
      db.run(add_attachment, attachment, a => {
        callback?.(a)
        resolve(a)
      })
    })
  }
})()
