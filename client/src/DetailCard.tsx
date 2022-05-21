import React from "react";
import {
  DatePicker,
  defaultDatePickerStrings,
  Dropdown,
  IBasePickerSuggestionsProps,
  IDatePicker,
  IDropdownOption,
  ITag,
  Stack,
  TagPicker,
  TextField
} from "@fluentui/react";

export class DetailCard extends React.Component<{noteId: number | undefined, availableTags: ITag[] | undefined, availableNotebooks: ITag[] | undefined}, { note?: Note, notebooks: IDropdownOption[] }> {
  private datePickerRef: React.RefObject<IDatePicker>;
  constructor(props: any) {
    super(props);
    this.state = {
      note: undefined,
      notebooks: []
    };
    this.datePickerRef = React.createRef<IDatePicker>();
  }

  componentDidMount() {
    this.loadNote();
  }

  componentDidUpdate(prevProps: Readonly<{ noteId: number | undefined, availableNotebooks: ITag[] | undefined }>, prevState: Readonly<{ note?: Note }>, snapshot?: any) {
    if (prevProps.noteId != this.props.noteId) {
      this.loadNote();
    }
    if (prevProps.availableNotebooks != this.props.availableNotebooks || this.state.notebooks.length == 0) {
      this.setState({...this.state, notebooks: this.props.availableNotebooks?.map(t => { return {key: t.key, text: t.name} }) ?? [{key: 11, text: 'test!'}]})
    }

  }

  private loadNote() {
    if (this.props.noteId) {
      fetch("/api/notes/" + this.props.noteId)
          .then((res) => res.json())
          .then((data : RawNote) => {
            let note: Note = {
              notebookId: data.notebookId,
              title: data.title ?? '',
              createTime: new Date(Date.parse(data.createTime)),
              tags: []
            }
            console.log(data);
            let tagNames = data.tags?.split(',') ?? []
            let tagIds = data.tagIds?.split(',') ?? []

            for (let i = 0; i < tagNames.length; i++) {
              note.tags.push({ name: tagNames[i], key: tagIds[i]})
            }
            this.setState({...this.state, note: note});
            });
    }
  }
  render() {
    const listContainsTagList = (tag: ITag, tagList?: ITag[]) => {
      if (!tagList || !tagList.length || tagList.length === 0) {
        return false;
      }
      return tagList.some(compareTag => compareTag.key === tag.key);
    };

    const filterSuggestedTags = (filterText: string, tagList?: ITag[]): ITag[] => {
      return filterText
          ? this.props.availableTags?.filter(
              tag => tag.name.toLowerCase().indexOf(filterText.toLowerCase()) === 0 && !listContainsTagList(tag, tagList),
          ) || []
          : [];
    };

    const pickerSuggestionsProps: IBasePickerSuggestionsProps = {
      suggestionsHeaderText: 'Suggested tags',
      noResultsFoundText: 'No tags found',
    };

    const getTextFromItem = (item: ITag) => item.name;

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
      <Stack horizontal className='CardRow2'>
        <Dropdown className='NotebookDropdown' options={this.state.notebooks} selectedKey={this.state.note?.notebookId}/>
        <TagPicker onResolveSuggestions={filterSuggestedTags} getTextFromItem={getTextFromItem}
                   pickerSuggestionsProps={pickerSuggestionsProps} selectedItems={this.state.note?.tags} className="ItemTags"/>
      </Stack>
      <iframe className='BodyField' src={this.props.noteId ? ('http://localhost:3001/api/body/' + this.props.noteId) : 'text.html'}/>
    </Stack>;
  }

}

interface Note {
  notebookId : number;
  title: string;
  createTime: Date;
  tags: ITag[];
}

interface RawNote {
  notebookId : number;
  title: string;
  createTime: string;
  tags: string;
  tagIds: string;
}
