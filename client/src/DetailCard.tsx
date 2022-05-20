import React from "react";
import {
  BaseButton,
  DatePicker,
  defaultDatePickerStrings,
  IButtonStyles,
  IconButton,
  IDatePicker,
  IOverflowSetItemProps,
  OverflowSet,
  Stack,
  TextField
} from "@fluentui/react";

export class DetailCard extends React.Component<{noteId: number | undefined}, { note?: Note }> {
  private datePickerRef: React.RefObject<IDatePicker>;
  constructor(props: any) {
    super(props);
    this.state = {
      note: undefined
    };
    this.datePickerRef = React.createRef<IDatePicker>();
  }

  componentDidMount() {
    this.loadNote();
  }

  componentDidUpdate(prevProps: Readonly<{ noteId: number | undefined }>, prevState: Readonly<{ note?: Note }>, snapshot?: any) {
    if (prevProps.noteId != this.props.noteId) {
      this.loadNote();
    }
  }

  private loadNote() {
    if (this.props.noteId) {
      fetch("/api/notes/" + this.props.noteId)
          .then((res) => res.json())
          .then((data : RawNote) => {
            let note: Note = {
              notebookId: data.notebookId,
              title: data.title,
              createTime: new Date(Date.parse(data.createTime)),
              tags: []
            }
            let tagNames = data.tags.split(',')
            let tagIds = data.tagIds.split(',')

            for (let i = 0; i < tagNames.length; i++) {
              note.tags.push({ name: tagNames[i], id: tagIds[i]})
            }
            this.setState({note: note});
            });
    }
  }
  render() {
    const onRenderItem = (item: IOverflowSetItemProps): JSX.Element => {
      return (
          <BaseButton text={item.name}/>
      );
    }

    const onRenderOverflowButton = (overflowItems: any[] | undefined): JSX.Element => {
      const buttonStyles: Partial<IButtonStyles> = {
        root: {
          minWidth: 0,
          padding: '0 4px',
          alignSelf: 'stretch',
          height: 'auto',
        },
      };
      return (
          <IconButton
              role="menuitem"
              title="More options"
              styles={buttonStyles}
              menuIconProps={{iconName: 'More'}}
              menuProps={{items: overflowItems!}}
          />
      );
    };


    return <Stack className='DetailCard'>
      <Stack horizontalAlign='stretch' verticalAlign='center' horizontal
             className='CardRow1'>
        <span>Name:&nbsp;</span>
        <TextField value={this.state.note?.title} className='TitleField'/>
        <span>Date:&nbsp;</span>
        <DatePicker
            componentRef={this.datePickerRef}
            className='DateField'
            // label="Start date"
            allowTextInput
            ariaLabel="Select a date"
            value={this.state.note?.createTime}
            // onSelectDate={setValue as (date: Date | null | undefined) => void}
            // className={styles.control}
            // DatePicker uses English strings by default. For localized apps, you must override this prop.
            strings={defaultDatePickerStrings}
        />
      </Stack>
      <OverflowSet className="ItemTags" onRenderItem={onRenderItem}
                   onRenderOverflowButton={onRenderOverflowButton} items={this.state.note?.tags.map(t => this.toProp(t) )}
        />

      <iframe className='BodyField' src={this.props.noteId ? ('http://localhost:3001/api/body/' + this.props.noteId) : 'text.html'}/>
    </Stack>;
  }

  private toProp(t: Tag) : IOverflowSetItemProps {
    return { key: t.id, name: t.name};
  }

}

interface Note {
  notebookId : number;
  title: string;
  createTime: Date;
  tags: Tag[];
}

interface RawNote {
  notebookId : number;
  title: string;
  createTime: string;
  tags: string;
  tagIds: string;
}

interface Tag {
  name: string;
  id: string;
}
