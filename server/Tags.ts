import { Database, Statement } from "better-sqlite3";
import { prepare_many } from "./sql_helper.js";

export class Tags {
  private readonly find_tag_by_name: Statement<string>;
  private readonly add_tag_to_note: Statement<NoteTag>;
  private readonly add_tag: Statement<string>;
  private readonly delete_tags: (i: number) => Statement;

  constructor(db: Database) {
    this.find_tag_by_name = db.prepare("select tagId from tags where name = ?");
    this.add_tag_to_note = db.prepare(
      "insert into noteTags (noteId, tagId) values ($noteId, $tagId)"
    );
    this.add_tag = db.prepare(
      "insert into Tags (name, isExpanded) values (?, false)"
    );
    this.delete_tags = prepare_many(
      db,
      "delete from NoteTags where noteId in (#noteIds)",
      "#noteIds"
    );
  }

  addTagId(noteId: number | bigint, tagId: number | bigint) {
    this.add_tag_to_note.run({ noteId: noteId, tagId: tagId });
  }

  addTag(noteId: number | bigint, tagName: string) {
    if (!tagName) return undefined;
    const r = this.find_tag_by_name.get(tagName) as {tagId: number};
    if (r) {
      this.addTagId(noteId, r.tagId);
      return r.tagId;
    } else {
      console.log("adding new tag...");
      const added_tag = this.add_tag.run(tagName);
      if (added_tag.changes > 0) {
        console.log("adding to note");
        this.add_tag_to_note.run({
          noteId: noteId,
          tagId: added_tag.lastInsertRowid,
        });
      }
      return added_tag.lastInsertRowid;
    }
  }

  removeTags(noteIds: (bigint | number)[]) {
    this.delete_tags(noteIds.length).run(noteIds);
  }
}

export interface NoteTag {
  noteId: number | bigint;
  tagId: number | bigint;
}
