import React from "react";
import {
  CommandBarButton,
  DocumentCard, DocumentCardActivity,
  DocumentCardDetails, DocumentCardStatus, DocumentCardTitle,
  INavLink,
  Stack
} from "@fluentui/react";

export class NoteList extends React.Component<{filterId: string | undefined, selectedId?: number | undefined, onSelectedIdChanged?: (key?: string) => void, limit?: number}, {noteList: Note[]}> {
  constructor(props: any) {
    super(props);
    this.state = {
      noteList: []
    };
    this.onSelect = this.onSelect.bind(this)
  }

  componentDidUpdate(prevProps: Readonly<{ filterId: string | undefined; selectedId?: number | undefined; onSelectedIdChanged?: (key?: string) => void }>, prevState: Readonly<{ noteList: Note[] }>, snapshot?: any) {
    if (this.props.filterId != prevProps.filterId) {
      if (this.props.filterId) {
        console.log("showing notes for " + this.props.filterId + " again")
        fetch("/api/" + (this.props.filterId ?? '') + '/' + (this.props.limit ?? 100) + '/0')
            .then((res) => res.json())
            .then((data) => {
              let notes: Note[] = [];
              data.notes.forEach((n: Note) =>
                  notes.push(n))
              this.setState({
                noteList: notes
              });
            });
      } else {
        this.setState({noteList: []})
      }
    }
  }

  onSelect(ev?: React.MouseEvent<HTMLElement>, item?: INavLink) {
    this.props.onSelectedIdChanged?.(item?.key)
  }

  render() {
    let notes = [];
    for (let i = 0; i < this.state.noteList.length; i++) {
      let note = this.state.noteList[i]
      notes.push(<DocumentCard key={note.id} className='ListItem'>
        <DocumentCardDetails>
          <DocumentCardTitle title={note.title}/>
          <DocumentCardStatus status={note.attachments}
                              statusIcon="attach"/>
          <DocumentCardActivity activity={'Created: ' + note.createTime}
                                people={[{
                                  name: 'Uri',
                                  profileImageSrc: ''
                                }]}/>
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
}
