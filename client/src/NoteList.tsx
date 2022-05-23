import React, {
  createRef,
  KeyboardEventHandler,
  RefObject, useEffect, useRef,
  useState
} from "react";
import {
  CommandBarButton,
  DocumentCard,
  DocumentCardActivity,
  DocumentCardDetails,
  DocumentCardLogo,
  DocumentCardPreview,
  DocumentCardStatus,
  DocumentCardTitle, DocumentCardType, IDocumentCard,
  INavLink,
  Stack
} from "@fluentui/react";
import eventBus from "./EventBus";

function formatFileSize(bytes : number,decimalPoint?: number) {
  if(bytes == 0) return '0 Bytes';
  var k = 1000,
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
  onSelectedIdChanged?: (key?: number) => void,
  limit?: number,
  searchTerm: string | undefined, tabIndex: number | undefined}> = (props: {filterId: string | undefined,
  selectedId?: number | undefined,
  onSelectedIdChanged?: (key?: number) => void,
  limit?: number,
  searchTerm: string | undefined, tabIndex: number | undefined}) =>
{
  const [noteList, setNoteList] = useState<Note[]>([])
  useEffect(() => {
    loadNotes();
    eventBus.on('note-detail-change', loadNotes)
    eventBus.on('note-collection-change', checkChange)
    return () => {
      eventBus.remove('note-detail-change', loadNotes)
      eventBus.remove('note-collection-change', checkChange)
    }
  },[])

  useEffect(() => {
    console.log("loading nodes")
    loadNotes()
  }, [props.filterId, props.searchTerm])

  useEffect(() => {
    console.log("selecting note " + props.selectedId)
    selectNote();
  }, [props.selectedId])


  const selectNote = () => {
    let newNotes = [...noteList]
    noteList.forEach((n: Note) => {
      n.selected = props.selectedId == n.id;
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
                selected: props.selectedId == n.id})
            })
            setNoteList(notes);
            if (!selectedFound && data.notes.length > 0) {
              props.onSelectedIdChanged?.(data.notes[0].id);
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

  let notes = [];
  for (let i = 0; i < noteList.length; i++) {
    let note = noteList[i]
    let className = note.selected ? 'ListItem is-selected' : 'ListItem'
    notes.push(<DocumentCard key={note.id} className={className}
                             type={DocumentCardType.compact}
                             onClick={() => props.onSelectedIdChanged?.(note.id)}>
      <DocumentCardLogo logoIcon={fileTypeToIcon[note.mime ?? 'text'] ?? "attach"}/>
      <DocumentCardDetails>
        <DocumentCardTitle title={note.title} className='ListItemTitle'/>
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
      <div className='ListView'>
        <Stack tabIndex={props.tabIndex} key={props.filterId} horizontalAlign='start' verticalAlign='start'>
          {notes}
        </Stack>
      </div>
  );
};


interface Note {
  id : number;
  createTime : string;
  title : string;
  attachments: string;
  size: number;
  mime: string;
  selected: boolean;
}
