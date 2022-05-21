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
  'application/pdf': 'PDF',

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
  }
  componentDidMount() {
    this.loadNotes();
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
            data.notes.forEach((n: Note) => {
              let attachments = n.attachments;
              let count = n.attachments?.match(/,/g)?.length || 0
              if (count > 0) {
                attachments = '' + (count+1) + ' attachments'
              }
              notes.push({...n, attachments: attachments, selected: this.props.selectedId == n.id})
            })
            this.setState({
              noteList: notes
            });
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
        <DocumentCardLogo logoIcon={fileTypeToIcon[note.mime] ?? "attach"}/>
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
