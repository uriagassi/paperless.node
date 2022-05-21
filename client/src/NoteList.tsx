import React from "react";
import {
  CommandBarButton,
  DocumentCard,
  DocumentCardActivity,
  DocumentCardDetails,
  DocumentCardLogo,
  DocumentCardPreview,
  DocumentCardStatus,
  DocumentCardTitle, DocumentCardType,
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

export class NoteList
    extends React.Component<{filterId: string | undefined,
      selectedId?: number | undefined,
      onSelectedIdChanged?: (key?: number) => void,
      limit?: number,
      searchTerm: string | undefined}, {noteList: Note[]}> {
  constructor(props: any) {
    super(props);
    this.state = {
      noteList: []
    };
    this.onSelect = this.onSelect.bind(this)
    this.loadNotes = this.loadNotes.bind(this)
    this.componentDidMount = this.componentDidMount.bind(this)
    this.checkChange = this.checkChange.bind(this)
  }
  componentDidMount() {
    this.loadNotes();
    eventBus.on('note-detail-change', this.loadNotes)
    eventBus.on('note-collection-change', this.checkChange)
  }

  componentDidUpdate(prevProps: Readonly<{ filterId: string | undefined; selectedId?: number | undefined; searchTerm: string | undefined }>, prevState: Readonly<{ noteList: Note[] }>, snapshot?: any) {
    if (this.props.filterId != prevProps.filterId || this.props.searchTerm != prevProps.searchTerm) {
      this.loadNotes();
    } else if (this.props.selectedId != prevProps.selectedId) {
      this.selectNote();
    }
  }

  private selectNote() {
    this.state.noteList.forEach((n: Note) => n.selected = this.props.selectedId == n.id)
    this.setState({noteList: this.state.noteList})
  }

  private loadNotes() {
    if (this.props.filterId || this.props.searchTerm) {
      let filter = this.props.filterId ?? ''
      if (this.props.searchTerm ?? '' != '') {
        filter = 'search?term=' + encodeURIComponent(this.props.searchTerm ?? '') + '&'
      }
      fetch("/api/" + filter + 'limit=' + (this.props.limit ?? 100) + '&lastItem=0')
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
              selectedFound = selectedFound || (this.props.selectedId == n.id)
              notes.push({...n, attachments: attachments, selected: this.props.selectedId == n.id})
            })
            this.setState({
              noteList: notes
            });
            if (!selectedFound && data.notes.length > 0) {
              this.onSelect(data.notes[0].id)
            }
          });
    } else {
      console.log('clearing list')
      this.setState({noteList: []})
    }
  }

  onSelect(key: number) {
    this.props.onSelectedIdChanged?.(key)
  }

  render() {
    let notes = [];
    for (let i = 0; i < this.state.noteList.length; i++) {
      let note = this.state.noteList[i]
      let className = note.selected ? 'ListItem is-selected' : 'ListItem'
      notes.push(<DocumentCard key={note.id} className={className} type={DocumentCardType.compact} onClick={() => this.onSelect(note.id)}>
        <DocumentCardLogo logoIcon={fileTypeToIcon[note.mime ?? 'text'] ?? "attach"}/>
        <DocumentCardDetails>
          <DocumentCardTitle title={note.title} className='ListItemTitle'/>
          <DocumentCardTitle title={note.createTime.split(' ')[0]} showAsSecondaryTitle/>
          <DocumentCardStatus status={note.attachments + ' ' + formatFileSize(note.size)}
                              statusIcon={fileTypeToIcon[note.mime] ?? "attach"}/>
        </DocumentCardDetails>
      </DocumentCard>)
    }
    if (this.state.noteList.length >= (this.props.limit ?? 100)) {
      notes.push(
          <CommandBarButton text='More...'/>
      )
    }
    return (
        <Stack key={this.props.filterId} horizontalAlign='start' verticalAlign='start'
               className='ListView'>
          {notes}
        </Stack>
    );
  }

  private checkChange(data: { notebooks?: number[], tags?: number[]}) {
    if (this.props.filterId?.startsWith('notebook')) {
      if (data.notebooks?.filter(n => this.props.filterId == 'notebooks/' + n + '?')) {
        this.loadNotes()
      }
    } else if (this.props.filterId?.startsWith('tag')) {
      if (data.tags?.filter(n => this.props.filterId == 'tags/' + n + '?')) {
        this.loadNotes()
      }
    }
  }
}

interface Note {
  id : number;
  createTime : string;
  title : string;
  attachments: string;
  size: number;
  mime: string;
  selected: boolean;
}
