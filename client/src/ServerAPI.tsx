import { IAuth } from "./auth/IAuth";
import { ITagWithChildren } from "./TagList";

export class ServerAPI {
  auth?: IAuth;

  async make_call(input: string, init?: RequestInit | undefined, with_token = false): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (with_token && this.auth?.access_token) {
      headers.append("x-access-token", this.auth.access_token);
    }
    const result = await fetch(input, { ...init, headers: headers });
    console.log(result);
    if (result.status === 403) {
      if (!with_token) {
        return this.make_call(input, init, true);
      } else {
        this.auth?.forceLogin();
      }
    } else if (result.status == 401) {
      await this.authSetup();
      this.auth?.forceLogin();
    }

    return result;
  }

  async loadNotebooks(): Promise<{ tags: ITagWithChildren[]; notebooks: ITagWithChildren[] }> {
    const res = await this.make_call("/api/notebooks_and_tags");
    return await (res.json() as Promise<{ tags: ITagWithChildren[]; notebooks: ITagWithChildren[] }>);
  }

  async loadNotes(filter: string, limit?: number): Promise<{ notes: Note[] }> {
    const res = await this.make_call("/api/" + filter + "limit=" + (limit ?? 100) + "&lastItem=0");
    return await res.json();
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
    this.auth?.login();
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

  // TODO!!
  async toggleExpand(path: string, isExpanded: boolean | undefined) {
    await this.make_call(`/api/${path}expand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expanded: isExpanded ? 0 : 1 }),
    });
  }

  async emptyTrash() {
    await this.make_call(`/api/trash`, { method: "DELETE" });
  }

  async updateTag(tag: ITagWithChildren): Promise<{ key?: string }> {
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
