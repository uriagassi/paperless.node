import config from "config";
import Sqlite3 from "better-sqlite3";
import fs from "fs";
import path from "path";
import readline from "readline";

export module cleanup {
  const baseDir = config.get('paperless.baseDir')
  const db = new Sqlite3(baseDir + '/paperless.sqlite');
  const attachmentsDir = config.get('paperless.baseDir') + '/attachments/'

  const delete_unused_tags = db.prepare("delete from Tags where tagId not in (select parentId from Tags where parentId is not null) and tagId not in (select tagId from NoteTags)")

  const find_unused_tags = db.prepare("select name from Tags where tagId not in (select parentId from tags where parentId is not null) and tagId not in (select tagId from notetags)")

  const find_all_filenames = db.prepare('select uniqueFileName from Attachments')

  function findOrphanFiles() {
    const connectedFiles = new Set(find_all_filenames.all().map(({ uniqueFileName }) => uniqueFileName));
    const files = fs.readdirSync(attachmentsDir).filter((f : string) => {
      return !f.startsWith('.') && fs.lstatSync(
        path.join(attachmentsDir, f)).isFile()
    });
    return files.filter((f:string) => !connectedFiles.has(f))
  }
  console.log('Orphan files:')
  const orphanFiles = findOrphanFiles();
  if (orphanFiles.length === 0) {
    console.log('No orphan files!')
  }
  orphanFiles.forEach((f:string,  i:number) => console.log(`${i+1}. ${f}`))

  console.log('Empty tags:')
  const unused_tags = find_unused_tags.all();
  if (unused_tags.length === 0) {
    console.log('No unused tags!')
  }
  unused_tags.forEach(({name}, i:number) => console.log(`${i+1}. ${name}`))

  if (unused_tags.length > 0 || orphanFiles.length > 0) {
    const rl = readline.createInterface(process.stdin, process.stdout);
    console.log('Choose Action:')
    console.log('1. Move attachments')
    console.log('2. Delete empty tags')
    console.log('3. Quit')
    rl.question("", (s:string) => {
      switch (s) {
        case '1':
          const orphanPath = path.join(config.get('paperless.baseDir'),
            'orphans');
          fs.mkdirSync(orphanPath)
          orphanFiles.forEach((f:string) => {
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
}
