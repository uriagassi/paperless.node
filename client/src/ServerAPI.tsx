import {ITagWithChildren} from "./TagList";

export class ServerAPI {
  headers : {key: string, value: string}[] = []
  setHeader(header: {key: string, value: string}) {
    this.headers.push(header);
  }

  make_call(input : string, init?: RequestInit | undefined) : Promise<Response> {
    const headers = new Headers(init?.headers);
    this.headers.forEach((h) => headers.append(h.key, h.value))
    return fetch(input, { method: init?.method, headers: headers, body: init?.body})
  }

  loadNotebooks() : Promise<{ tags: ITagWithChildren[], notebooks: any[] }> {
    return this.make_call("/api/notebooks_and_tags")
        .then(res => res.json() as Promise<{ tags: ITagWithChildren[], notebooks: any[] }>)
  }

  loadNotes(filter : string, limit?: number) : Promise<any> {
    return this.make_call("/api/" + filter + 'limit=' + (limit ?? 100) + '&lastItem=0')
        .then((res) => res.json())
  }

  loadNote(noteId: string | number) : Promise<RawNote> {
    return this.make_call("/api/notes/" + noteId)
        .then((res) => res.json() as Promise<RawNote>)
  }

  user() : Promise<{user_id: string, user_name: string}> {
    return this.make_call('api/user').then(res => res.json())
  }

}

interface RawNote {
  attachments: [{id: number, fileName: string, uniqueFileName: string}]
  notebookId: number;
  title: string;
  createTime: string;
  tags: string;
  tagIds: string;
  parts: number;
}
