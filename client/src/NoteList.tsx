import React, {
  useEffect,
  useState
} from "react";
import {
  CommandBarButton,
  DocumentCard,
  DocumentCardDetails,
  DocumentCardLogo,
  DocumentCardStatus,
  DocumentCardTitle, DocumentCardType, FocusZone,
  Stack
} from "@fluentui/react";
import eventBus from "./EventBus";

function formatFileSize(bytes : number,decimalPoint?: number) {
  if(bytes == 0) return '0 Bytes';
  const k = 1000,
      dm = decimalPoint || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const fileTypeToIcon : {[key: string]: string} = {
  'image/jpeg': 'FileImage',
  'image/png': 'FileImage',
  'application/pdf': 'PDF',
  'text': 'TextDocument'
}
export const NoteList: React.FunctionComponent<{filterId: string | undefined,
  selectedId?: number | undefined,
  onSelectedIdChanged?: (key: number, selectedKeys: Set<number>) => void,
  limit?: number,
  searchTerm: string | undefined, tabIndex: number | undefined, selectedNotes: Set<number>, keyState: KeyState}> = (props: {filterId: string | undefined,
  selectedId?: number | undefined,
  onSelectedIdChanged?: (key: number, selectedKeys: Set<number>) => void,
  limit?: number,
  searchTerm: string | undefined, tabIndex: number | undefined, selectedNotes: Set<number>, keyState: KeyState}) =>
{
  const [noteList, setNoteList] = useState<Note[]>([])
  useEffect(() => {
    loadNotes();
  },[])

  useEffect(() => {
        let eventLoadNotes = () => loadNotes()
        let eventCheckChange = (e: CustomEvent<{ notebooks?: number[], tags?: number[]}>) => checkChange(e.detail)
        eventBus.on('note-detail-change', eventLoadNotes)
        eventBus.on('note-collection-change', eventCheckChange)
        return () => {
          eventBus.remove('note-detail-change', eventLoadNotes)
          eventBus.remove('note-collection-change', eventCheckChange)
        }
      }
  )

  useEffect(() => {
    loadNotes()
  }, [props.filterId, props.searchTerm])

  useEffect(() => {
    console.log("selecting note " + props.selectedId + "(" + Array.from(props.selectedNotes) + ")")
    selectNote();
  }, [props.selectedId, props.selectedNotes])


  const selectNote = () => {
    let newNotes = [...noteList]
    noteList.forEach((n: Note) => {
      n.active = props.selectedId == n.id;
      n.selected = props.selectedNotes?.has(n.id)
    })
    setNoteList(newNotes)
  }

  const loadNotes = () => {
    if (props.filterId || props.searchTerm) {
      let filter = props.filterId ?? ''
      if (props.searchTerm ?? '' != '') {
        filter = 'search?term=' + encodeURIComponent(props.searchTerm ?? '') + '&'
      }
      fetch("/api/" + filter + 'limit=' + (props.limit ?? 100) + '&lastItem=0')
          .then((res) => res.json())
          .then((data) => {
            let notes: Note[] = [];
            let selectedFound = false;
            data.notes.forEach((n: Note) => {
              let attachments = n.attachments;
              let count = n.attachments?.match(/,/g)?.length || 0
              if (count > 0) {
                attachments = '' + (count+1) + ' attachments'
              }
              selectedFound = selectedFound || (props.selectedId == n.id)
              notes.push({...n,
                attachments: attachments,
                active: props.selectedId == n.id})
            })
            setNoteList(notes);
            if (!selectedFound && data.notes.length > 0) {
              props.onSelectedIdChanged?.(data.notes[0].id, new Set([data.notes[0].id]));
            }
          });
    } else {
      console.log('clearing list')
      setNoteList([])
    }
  }

  const checkChange = (data: { notebooks?: number[], tags?: number[]}) => {
    if (props.filterId?.startsWith('notebook')) {
      if (data.notebooks?.filter(n => props.filterId == 'notebooks/' + n + '?')) {
        loadNotes()
      }
    } else if (props.filterId?.startsWith('tag')) {
      if (data.tags?.filter(n => props.filterId == 'tags/' + n + '?')) {
        loadNotes()
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: number) => {
    if (e.key == 'Delete') {
      deleteNote(id)
    }
  }

  const deleteNote = (id: number) => {
    const requestOptions = {
      method: 'DELETE' }
    fetch('api/notes/' + id, requestOptions).then(() => {
      let affectedList = { notebooks : [3], tags: [0]}
      if (props.filterId) {
        if (props.filterId.split('/')[0] == 'notebooks') {
          affectedList.notebooks.push(Number(props.filterId.split('/')[1]))
        } else {
          affectedList.tags = [Number(props.filterId.split('/')[1])];
        }
      }
      eventBus.dispatch('note-collection-change', affectedList)
    })
  }

  const onFocusChange = (note: Note) => {
    let noteId = note.id
    let keyState = props.keyState
    console.log(keyState)
    if (keyState.ctrlKey || keyState.metaKey) {
      const index = props.selectedNotes?.has(noteId);
      const selected = new Set(props.selectedNotes);
      if (index) {
        selected.delete(noteId)
      } else {
        selected.add(noteId)
      }
      props.onSelectedIdChanged?.(noteId, selected)

    } else if (keyState.shiftKey) {
      if (props?.selectedId) {
        let startIndex = noteList.indexOf(note)
        let endIndex = noteList.findIndex((n) => n.id == props.selectedId)
        if (endIndex < startIndex) {
          [startIndex, endIndex] = [endIndex, startIndex]
        }
        console.log("range is [" + startIndex + "," + endIndex + ")")
        let selected = new Set(props.selectedNotes)
          console.log("finding range")
          if (startIndex > -1) {
            for (let i = startIndex; i <= endIndex; i++) {
              console.log("looking for id " + noteList[i].id + " [" + i + "]")
              if (!note.selected) {
                selected.add(noteList[i].id)
              } else {
                selected.delete(noteList[i].id)
              }
            }
            selected.add(noteId)
            console.log("setting selected " + selected)
            props.onSelectedIdChanged?.(noteId, selected)
          }
      }
    } else {
      props.onSelectedIdChanged?.(noteId, new Set([noteId]))
    }
  }

  let notes = [];
  for (let i = 0; i < noteList.length; i++) {
    let note = noteList[i]
    let className = note.active ? 'ListItem is-active' : 'ListItem'
    if (note.selected) className += ' is-selected'
    notes.push(<DocumentCard key={note.id} className={className}
                             type={DocumentCardType.compact}
                             onFocus={() => onFocusChange(note) }
                             onKeyDown={(e) => onKeyDown(e, note.id) }
                             data-is-focusable>
      <DocumentCardLogo logoIcon={fileTypeToIcon[note.mime ?? 'text'] ?? "attach"}/>
      <DocumentCardDetails>
        <DocumentCardTitle title={note.title} className='ListItemTitle' data-is-not-focusable/>
        <DocumentCardTitle title={note.createTime.split(' ')[0]} showAsSecondaryTitle/>
        <DocumentCardStatus status={note.attachments + ' ' + formatFileSize(note.size)}
                            statusIcon={fileTypeToIcon[note.mime] ?? "attach"}/>
      </DocumentCardDetails>
    </DocumentCard>)
  }
  if (noteList.length >= (props.limit ?? 100)) {
    notes.push(
        <CommandBarButton text='More...'/>
    )
  }
  return (
      <FocusZone className='ListView' >
        <Stack tabIndex={props.tabIndex} key={props.filterId} horizontalAlign='start' verticalAlign='start'>
          {notes}
        </Stack>
      </FocusZone>
  );
};


interface Note {
  id : number;
  createTime : string;
  title : string;
  attachments: string;
  size: number;
  mime: string;
  active: boolean;
  selected: boolean | undefined;
}

export interface KeyState {
  metaKey? : boolean;
  ctrlKey? : boolean;
  shiftKey? : boolean;
}
