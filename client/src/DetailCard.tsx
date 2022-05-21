import React from "react";
import { format } from "date-fns";
import eventBus from "./EventBus";

import {
  DatePicker,
  defaultDatePickerStrings,
  Dropdown,
  IBasePickerSuggestionsProps,
  IDatePicker,
  IDropdownOption, IPickerItemProps,
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
    this.onTitleChanged = this.onTitleChanged.bind(this);
    this.onDateChanged = this.onDateChanged.bind(this);
    this.onNotebookChanged = this.onNotebookChanged.bind(this);
    this.onTagsChanged = this.onTagsChanged.bind(this);
    this.addTag = this.addTag.bind(this);
    this.removeTag = this.removeTag.bind(this);
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
        <TextField value={this.state.note?.title || ''} className='TitleField' onChange={this.onTitleChanged}/>
        <span>Date:&nbsp;</span>
        <DatePicker
            componentRef={this.datePickerRef}
            className='DateField'
            allowTextInput
            ariaLabel="Select a date"
            value={this.state.note?.createTime}
            onSelectDate={this.onDateChanged}
            strings={defaultDatePickerStrings}
        />
      </Stack>
      <Stack horizontal className='CardRow2'>
        <Dropdown className='NotebookDropdown' options={this.state.notebooks} selectedKey={this.state.note?.notebookId} onChange={this.onNotebookChanged} />
        <TagPicker onResolveSuggestions={filterSuggestedTags} getTextFromItem={getTextFromItem}
                   pickerSuggestionsProps={pickerSuggestionsProps} selectedItems={this.state.note?.tags} className="ItemTags"
            onChange={this.onTagsChanged} />
      </Stack>
      <iframe className='BodyField' src={this.props.noteId ? ('http://localhost:3001/api/body/' + this.props.noteId) : 'text.html'}/>
    </Stack>;
  }


  private removeTag(deletedTag: ITag)  {
    const requestOptions = {
      method: 'DELETE',
    }
    fetch('/api/notes/' + this.props.noteId + '/tags/' + deletedTag.key, requestOptions).then(d => console.log(d))
  }

  private onTagsChanged(newTags: ITag[] | undefined) {
    if (this.state.note && this.state.note.tags != newTags) {
      let removedTags : ITag[] = []
      let addedTags : ITag[] = []
      if (!newTags) {
        removedTags = this.state.note.tags
      } else {
        removedTags = this.state.note.tags.filter(t => newTags.filter(nt => nt.key == t.key).length == 0)
        addedTags = newTags.filter(nt => this.state.note?.tags.filter(t => nt.key == t.key).length == 0)
      }
      addedTags.forEach(this.addTag)
      removedTags.forEach(this.removeTag)
      eventBus.dispatch('note-collection-change', {tags: removedTags.map(t => t.key).concat(addedTags.map(t => t.key))})
      if (newTags) {
        this.state.note.tags = newTags
      }
      this.setState({note: this.state.note})
    }
  }

  private addTag(tag: ITag) {
    const requestOptions = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({tagId: tag.key})
    }
    fetch('/api/notes/' + this.props.noteId + '/addTag', requestOptions).then(d => console.log(d))
  }

  private onTitleChanged(event : any, newValue: string | undefined) {
    if (newValue && this.state?.note?.title && this.state?.note?.title != newValue) {
      this.state.note.title = newValue;
      this.setState({note : this.state.note})
      this.updateNote()
      console.log('dispatching')
      eventBus.dispatch('note-detail-change', this.props.noteId)
    }
  }

  private onNotebookChanged(event : any, option?: IDropdownOption, newValue?: number | undefined) {
    if (option && this.state?.note?.notebookId && this.state?.note?.notebookId != option.key) {
      let oldNotebook = this.state.note.notebookId
      this.state.note.notebookId = Number(option.key);
      this.setState({note : this.state.note})
      this.updateNote()
      eventBus.dispatch('note-collection-change', { notebooks: [oldNotebook, this.state.note.notebookId]})
    }
  }

  private onDateChanged(newValue: Date | null | undefined) {
    if (newValue && this.state?.note?.createTime && this.state?.note?.createTime != newValue) {
      this.state.note.createTime = newValue;
      this.setState({note : this.state.note})
      this.updateNote()
      eventBus.dispatch('note-detail-change', this.props.noteId)
    }
  }

  private updateNote() {
    const requestOptions = {
      method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notebookId: this.state.note?.notebookId || 0,
          title: this.state.note?.title || '',
        createTime: format(this.state.note?.createTime || 0, 'yyyy-MM-dd')
    })
  };
    fetch('/api/notes/' + this.props.noteId,  requestOptions).then(response => response.json()).then(d => console.log(d))
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
