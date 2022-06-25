(function () {
  const config = require('config')
  const sqlite3 = require('better-sqlite3');
  const baseDir = config.get('paperless.baseDir')
  const db = new sqlite3(baseDir + '/paperless.sqlite');
  const fs = require('fs')
  const path = require('path')
  const readline = require('readline')
  const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

  const delete_unused_tags = db.prepare("delete from Tags where tagId not in (select parentId from Tags where parentId is not null) and tagId not in (select tagId from NoteTags)")

  const find_unused_tags = db.prepare("select name from Tags where tagId not in (select parentId from tags where parentId is not null) and tagId not in (select tagId from notetags)")

  const find_all_filenames = db.prepare('select uniqueFileName from Attachments')

  function findOrphanFiles() {
    const connectedFiles = new Set(find_all_filenames.all().map(f => f.UniqueFileName));
    const files = fs.readdirSync(attachmentsDir).filter(f => {
      return !f.startsWith('.') && fs.lstatSync(
        path.join(attachmentsDir, f)).isFile()
    });
    return files.filter(f => !connectedFiles.has(f))
  }
  console.log('Orphan files:')
  const orphanFiles = findOrphanFiles();
  if (orphanFiles.length === 0) {
    console.log('No orphan files!')
  }
  orphanFiles.forEach((f,  i) => console.log(`${i+1}. ${f}`))

  console.log('Empty tags:')
  const unused_tags = find_unused_tags.all();
  if (unused_tags.length === 0) {
    console.log('No unused tags!')
  }
  unused_tags.forEach((t, i) => console.log(`${i+1}. ${t.Name}`))

  if (unused_tags.length > 0 || orphanFiles.length > 0) {
    const rl = readline.createInterface(process.stdin, process.stdout);
    console.log('Choose Action:')
    console.log('1. Move attachments')
    console.log('2. Delete empty tags')
    console.log('3. Quit')
    rl.question("", s => {
      switch (s) {
        case '1':
          const orphanPath = path.join(config.get('paperless.baseDir'),
            'orphans');
          fs.mkdirSync(orphanPath)
          orphanFiles.forEach(f => {
            fs.renameSync(path.join(attachmentsDir, f),
              path.join(orphanPath, f))
          })
          break
        case '2':
          delete_unused_tags.run()
      }
      rl.close()
    })
  }
})()
