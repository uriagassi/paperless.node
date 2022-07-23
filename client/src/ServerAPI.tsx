import { ITag } from "@fluentui/react";
import { IAuth } from "./auth/IAuth";

export class ServerAPI {
  auth?: IAuth;
  csrfToken?: string;

  async make_call(input: string, init?: RequestInit | undefined, token?: string): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (token) {
      headers.append("x-access-token", token);
    }
    if (["POST", "DELETE"].includes(init?.method ?? "") && this.csrfToken) {
      headers.append("csrf-token", this.csrfToken);
    }
    const result = await fetch(input, { ...init, headers: headers });
    if (result.status === 403) {
      if (!token) {
        return this.make_call(input, init, this.auth?.access_token());
      } else {
        this.auth?.login();
      }
    } else if (result.status == 401) {
      await this.authSetup();
      this.auth?.login();
    }

    return result;
  }

  async loadNotebooks(): Promise<{ tags: Tag[]; notebooks: Notebook[] }> {
    const res = await this.make_call("/api/notebooks_and_tags");
    const object = await res.json();
    return {
      tags: object.tags.map((t: Tag) => {
        return { ...t, kind: "tag" };
      }),
      notebooks: object.notebooks.map((t: Notebook) => {
        return { ...t, kind: "notebook" };
      }),
    };
  }

  async loadNotes(filter: Folder | string | undefined, limit?: number, order?: string): Promise<{ notes: Note[] }> {
    if (filter) {
      let path =
        typeof filter === "string" ? `search?term=${encodeURIComponent(filter)}&` : `${filter.kind}s/${filter.key}?`;
      if (order) {
        path += `orderBy=${order}&`;
      }
      const res = await this.make_call(`/api/${path}limit=${limit ?? 100}&lastItem=0`);
      return await res.json();
    }
    return { notes: [] };
  }

  async loadNote(noteId: string | number): Promise<RawNote> {
    const res = await this.make_call("/api/notes/" + noteId);
    return await (res.json() as Promise<RawNote>);
  }

  async user(): Promise<{ user_id: string; user_name: string }> {
    const res = await this.make_call("api/user");
    return await res.json();
  }

  async addNotebook(notebookName: string): Promise<Response> {
    return await this.make_call(`/api/notebooks/${notebookName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  }

  async authSetup() {
    console.log("auth setup");
    const params = await (await this.make_call("/auth")).json();
    console.log(params);
    const { Auth } = await import("./auth/" + (params.handler ?? "EmptyAuth") + ".tsx");
    console.log(Auth);
    this.auth = new Auth(params);
    console.log(this.auth);
    ({ csrfToken: this.csrfToken } = await (await fetch("/csrf")).json());
  }

  async logout() {
    await this.auth?.logout();
    await fetch("/api/logout");
    window.location.hash = "";
    window.location.pathname = "";
    window.location.reload();
  }

  async authorizeGmail(token: string): Promise<string | null> {
    const result = await this.make_call(`/api/mail/auth?access_token=${token}`);
    if (result.status != 200) {
      return result.text();
    }
    return null;
  }

  async uploadNewNote(file: File) {
    const formData = new FormData();
    formData.append("newNote", file, file.name);
    await this.make_call("/api/files/new", { method: "POST", body: formData });
  }

  async importFiles() {
    await this.make_call("/api/files/import");
  }

  async importMail(): Promise<{ pendingThreads: number } | { authenticate: string }> {
    const res = await this.make_call("/api/mail/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return await res.json();
  }

  async checkFilesPending(): Promise<number> {
    const result = await this.make_call("/api/files/checkStatus");
    return (await result.json()).pending;
  }

  async checkGmailPending(): Promise<
    { pendingThreads: number; emailAddress: string } | { authenticate: string } | { notSupported: boolean }
  > {
    return (await this.make_call("/api/mail/pending")).json();
  }

  noteBodySrc(noteId?: number): string {
    return noteId ? `/api/body/${noteId}` : "text.html";
  }

  async newTag(name: string): Promise<number> {
    const result = await this.make_call("/api/tags/new", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name }),
    });
    return (await result.json()).key;
  }

  async addTagToNote(noteId: number, tagId: number) {
    await this.make_call(`/api/notes/${noteId}/addTag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tagId }),
    });
  }

  async purgeNote(noteId: number) {
    await this.make_call(`/api/notes/${noteId}`, { method: "DELETE" });
  }

  async updateNote(noteId: number, note: NoteUpdate) {
    await this.make_call(`/api/notes/${noteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
  }

  async removeTagFromNote(noteId: number, tagId: number) {
    await this.make_call(`/api/notes/${noteId}/tags/${tagId}`, { method: "DELETE" });
  }

  async split(noteId: number) {
    await this.make_call(`/api/notes/${noteId}/split`, { method: "POST" });
  }

  async move(notebookId: number | string, ...noteIds: number[]) {
    await this.make_call(`api/notes/${noteIds.join(",")}/notebook/${notebookId}`, {
      method: "POST",
    });
  }

  async delete(noteId: number) {
    await this.move("D", noteId);
  }

  async mergeInto(toNoteId: number, noteIds: number[]) {
    await this.make_call(`api/notes/${toNoteId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: noteIds,
        toNote: toNoteId,
      }),
    });
  }

  async deleteTag(tagId: number) {
    await this.make_call(`/api/tags/${tagId}`, { method: "DELETE" });
  }

  async deleteNotebook(notebookId: number | string) {
    await this.make_call(`/api/notebooks/${notebookId}`, { method: "DELETE" });
  }

  async toggleExpand(folder: Folder, isExpanded: boolean | undefined) {
    await this.make_call(`/api/${folder.kind}s/${folder.key}/expand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expanded: isExpanded ? 0 : 1 }),
    });
  }

  async emptyTrash() {
    await this.make_call(`/api/trash`, { method: "DELETE" });
  }

  async updateTag(tag: Tag): Promise<{ key?: number }> {
    const result = await this.make_call(`/api/tags/${tag.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tag.name,
        parent: tag.parent ?? 0,
      }),
    });
    return await result.json();
  }
}

interface RawNote {
  attachments: [{ id: number; fileName: string; uniqueFileName: string }];
  notebookId: number;
  title: string;
  createTime: string;
  tags: string;
  tagIds: string;
  parts: number;
}

export interface Note {
  id: number;
  createTime: string;
  title: string;
  attachments: string;
  size: number;
  mime: string;
  active: boolean;
  selected: boolean | undefined;
}

export interface NoteUpdate {
  notebookId: number;
  title: string;
  createTime: string;
}

export interface BaseTag extends ITag {
  key: number;
  isExpanded?: boolean;
  notes: number;
}

export interface Tag extends BaseTag {
  kind: "tag";
  parent?: number;
}

export interface Notebook extends BaseTag {
  kind: "notebook";
  type: string;
}

export type Folder = Tag | Notebook;

export function isNotebook(folder: Folder | undefined): folder is Notebook {
  return folder?.kind === "notebook";
}
export function isTag(folder: Folder | undefined): folder is Tag {
  return folder?.kind === "tag";
}

export function key(folder: Folder | undefined) {
  if (!folder) return undefined;
  return `${folder.kind}s/${folder.key}?`;
}
