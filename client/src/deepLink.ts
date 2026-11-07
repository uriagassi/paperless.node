import { Folder, Notebook, Tag } from "./ServerAPI";

export interface DeepLinkTarget {
  folder?: Folder;
  noteId?: number;
}

export async function resolveDeepLink(
  search: string,
  data: { notebooks: Notebook[]; tags: Tag[] },
  loadNote: (noteId: number) => Promise<{ notebookId?: number } | undefined>
): Promise<DeepLinkTarget> {
  const params = new URLSearchParams(search);
  const noteIdParam = params.get("noteId");
  if (!noteIdParam) return {};
  const noteId = Number(noteIdParam);
  if (!Number.isInteger(noteId)) return {};

  const folderKind = params.get("folderKind");
  const folderKey = params.get("folderKey");
  if (folderKind && folderKey) {
    const key = Number(folderKey);
    const folder =
      folderKind === "notebook"
        ? data.notebooks.find((n) => n.key === key)
        : folderKind === "tag"
        ? data.tags.find((t) => t.key === key)
        : undefined;
    return folder ? { folder, noteId } : {};
  }

  try {
    const note = await loadNote(noteId);
    const folder = data.notebooks.find((n) => n.key === note?.notebookId);
    return folder ? { folder, noteId } : {};
  } catch {
    return {};
  }
}
