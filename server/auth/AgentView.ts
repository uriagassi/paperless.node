import { Database } from "better-sqlite3";

export interface AgentNote {
  id: number;
  title: string;
  notebook: { id: number; name: string };
  tags: string[];
  createTime: string;
  updateTime: string;
  attachments: { mime: string }[];
  link: string;
}

export function agentNoteLink(noteId: number | bigint) {
  return `/?noteId=${noteId}`;
}

export function agentView(db: Database) {
  const select_note = db.prepare(
    "select n.noteId as id, n.title, n.createTime, n.updateTime, \
    n.notebookId, b.name as notebookName \
    from Notes n left join Notebooks b on b.notebookId = n.notebookId \
    where n.noteId = ?"
  );
  const select_tags = db
    .prepare(
      "select t.name from NoteTags nt join Tags t on t.tagId = nt.tagId \
      where nt.noteId = ? order by t.name"
    )
    .pluck();
  const select_mimes = db
    .prepare("select mime from Attachments where noteId = ?")
    .pluck();

  return function agentNote(noteId: number | bigint | string): AgentNote | undefined {
    const row = select_note.get(noteId) as
      | {
          id: number;
          title: string;
          createTime: string;
          updateTime: string;
          notebookId: number;
          notebookName: string;
        }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      title: row.title,
      notebook: { id: row.notebookId, name: row.notebookName },
      tags: select_tags.all(noteId) as string[],
      createTime: row.createTime,
      updateTime: row.updateTime,
      attachments: (select_mimes.all(noteId) as string[]).map((mime) => ({
        mime,
      })),
      link: agentNoteLink(row.id),
    };
  };
}
