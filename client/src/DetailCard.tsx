import React, {useEffect, useState} from "react";
import {format} from "date-fns";
import eventBus from "./EventBus";

import {
  DatePicker,
  defaultDatePickerStrings,
  Dropdown,
  IBasePickerSuggestionsProps,
  IDatePicker,
  IDropdownOption, ITag,
  Stack,
  TagPicker,
  TextField
} from "@fluentui/react";
import {ITagWithChildren} from "./TagList";
import {TagContextMenu} from "./TagContextMenu";
import {ServerAPI} from "./ServerAPI";
import {SynologySSO} from "./SynologySSO";

export const DetailCard: React.FunctionComponent<
    DetailCardProps> =
    (props) => {
      const datePickerRef = React.createRef<IDatePicker>();
      const [note, setNote] = useState<Note | undefined>();
      const [notebooks, setNotebooks] = useState<IDropdownOption[]>([]);
      const [modified, setModified] = useState<boolean>(false);

      useEffect(() => {
        loadNote();
      }, [props.noteId, props.availableTags])


      useEffect(() => {
        setNotebooks(props.availableNotebooks?.map(t => {
          return {key: t.key, text: t.name}
        }) ?? [{key: 11, text: 'test!'}])
      }, [props.availableNotebooks])


      const loadNote = () => {
        if (props.noteId) {
          props.api.loadNote(props.noteId)
              .then(data => {
                let note: Note = {
                  notebookId: data.notebookId,
                  title: data.title ?? '',
                  createTime: new Date(Date.parse(data.createTime)),
                  tags: []
                }
                let tagNames = data.tags?.split(',') ?? []
                let tagIds = data.tagIds?.split(',') ?? []

                for (let i = 0; i < tagNames.length; i++) {
                  note.tags.push({name: tagNames[i], key: Number(tagIds[i])})
                }
                setNote(note);
              });
        }
      }

      const addNewTags = (newTags: ITag[], callback: () => any, i : number = 0) => {
        if (newTags.length > i) {
          const requestOptions = {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: newTags[i].name})
          }
          fetch('/api/tags/new', requestOptions).then((r) => r.json()).then((r) => {
            newTags[i].key = r.key
            addNewTags(newTags, callback, i + 1)
          })
        } else {
          callback()
        }
      }


      const onTagsChanged = (newTags: ITag[] | undefined) => {
        let newlyCreatedTags = newTags?.filter(t => t.key == '-1') ?? [];
        if (newlyCreatedTags.length > 0) {
          addNewTags(newlyCreatedTags, () => onTagsChanged(newTags))
          eventBus.dispatch('note-collection-change', {})
        } else if (note && note.tags != newTags) {
          let removedTags: ITag[] = []
          let addedTags: ITag[] = []
          if (!newTags) {
            removedTags = note.tags
          } else {
            removedTags = note.tags
                .filter(t => newTags.filter(nt => nt.key == t.key).length == 0)
            addedTags = newTags
                .filter(nt => note?.tags.filter(t => nt.key == t.key).length == 0)
          }
          addedTags.forEach(addTag)
          removedTags.forEach(removeTag)
          eventBus.dispatch('note-collection-change',
              {tags:
                    removedTags.map(t => t.key).concat(addedTags.map(t => t.key))})
          setNote({...note, tags: newTags ?? []})
        }
      }

      const addTag = (tag: ITag) => {
        const requestOptions = {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({tagId: tag.key})
        }
        fetch('/api/notes/' + props.noteId + '/addTag', requestOptions).then(d => console.log(d))
      }

      useEffect(() => {
        let timer : NodeJS.Timeout | undefined = undefined
        if (modified && note) {
          timer = setTimeout(() => {
            console.log(`saving... ${note.title}`)
            updateNote(note)
            setModified(false)
            eventBus.dispatch('note-detail-change', props.noteId)
          }, 500)
        }
        return () => clearTimeout(timer)
      }, [note, modified])

      const onTitleChanged = (event: any, newValue: string | undefined) => {
        if (newValue && note?.title && note?.title != newValue) {
          setNote({...note, title: newValue})
          setModified(true)
        }
      }

      const onNotebookChanged = (event: any, option?: IDropdownOption) => {
        if (option && note?.notebookId && note?.notebookId != option.key) {
          let oldNotebook = note.notebookId
          updateNote({...note, notebookId: Number(option.key)});
          setNote(note)
          eventBus.dispatch('note-collection-change',
              {notebooks: [oldNotebook, note.notebookId]})
        }
      }

      const onDateChanged = (newValue: Date | null | undefined) => {
        if (newValue && note?.createTime && note?.createTime != newValue) {
          updateNote({...note, createTime: newValue});
          setNote(note)
          eventBus.dispatch('note-detail-change', props.noteId)
        }
      }

      const updateNote = (note: Note) => {
        const requestOptions = {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            notebookId: note?.notebookId || 0,
            title: note?.title || '',
            createTime: format(note?.createTime || 0, 'yyyy-MM-dd')
          })
        };
        fetch('/api/notes/' + props.noteId, requestOptions)
            .then(response => response.json())
            .then(d => console.log(d))
      }

      const listContainsTagList = (tag: ITag, tagList?: ITag[]) => {
        if (!tagList || !tagList.length || tagList.length === 0) {
          return false;
        }
        return tagList.some(compareTag => compareTag.key === tag.key);
      };

      const filterSuggestedTags = (filterText: string, tagList?: ITag[]): ITag[] => {
        let newTagList : ITag[] = []
        if (!props.availableTags?.some(t => t.name == filterText)) {
          newTagList = [{key: '-1', name: filterText}]
        }
        return filterText
            ?  [...props.availableTags?.filter(
                tag => tag.name.toLowerCase().indexOf(filterText.toLowerCase()) === 0 &&
                    !listContainsTagList(tag, tagList),
            ) || [], ...newTagList]
            : [];
      };

      const removeTag = (deletedTag: ITag) => {
        const requestOptions = {
          method: 'DELETE',
        }
        fetch('/api/notes/' + props.noteId + '/tags/' + deletedTag.key, requestOptions)
            .then(d => console.log(d))
      }

      const pickerSuggestionsProps: IBasePickerSuggestionsProps = {
        suggestionsHeaderText: 'Suggested tags',
        noResultsFoundText: 'No tags found',
      };

      const getTextFromItem = (item: ITag) => item.name;

      const [doUpdate, setDoUpdate] = useState<{target: Element, tag: ITagWithChildren} | undefined>();

      const onShowContextualMenu = (ev: React.MouseEvent<HTMLElement>) => {
        let tagItem = (ev.target as HTMLElement).closest('.ms-TagItem')
        if (tagItem) {
          const textContent = tagItem.querySelector('.ms-TagItem-text')?.textContent;
          const found = props.availableTags?.find(t => t.name == textContent);
          ev.preventDefault();
          setDoUpdate({target: tagItem, tag: found as ITagWithChildren})
        }
      }

      const onContextMenuDismiss = () => {
        setDoUpdate(undefined);
      }

      return <Stack className='DetailCard'>
        <Stack horizontalAlign='stretch' verticalAlign='center' horizontal
               className='CardRow1'>
          <span>Name:&nbsp;</span>
          <TextField value={note?.title || ''} className='TitleField'
                     onChange={onTitleChanged}/>
          <span>Date:&nbsp;</span>
          <DatePicker
              componentRef={datePickerRef}
              className='DateField'
              allowTextInput
              ariaLabel="Select a date"
              value={note?.createTime}
              onSelectDate={onDateChanged}
              strings={defaultDatePickerStrings}
          />
        </Stack>
        <Stack horizontal className='CardRow2' onContextMenu={onShowContextualMenu}>
          <Dropdown className='NotebookDropdown' options={notebooks}
                    selectedKey={note?.notebookId} onChange={onNotebookChanged}/>
          <TagPicker onResolveSuggestions={filterSuggestedTags}
                     getTextFromItem={getTextFromItem}
                     pickerSuggestionsProps={pickerSuggestionsProps}
                     selectedItems={note?.tags} className="ItemTags"
                     onChange={onTagsChanged}/>
          <TagContextMenu updateTag={props.updateTag} availableTags={props.availableTags} doUpdate={doUpdate} onDismiss={onContextMenuDismiss}/>
        </Stack>
        <iframe className='BodyField'
                src={props.sso.authenticate(props.noteId ? ('http://localhost:3001/api/body/' + props.noteId) : 'text.html')}/>
      </Stack>;

    }

interface Note {
  notebookId: number;
  title: string;
  createTime: Date;
  tags: ITag[];
}

interface DetailCardProps {
  noteId: number | undefined,
  availableTags: ITag[] | undefined,
  availableNotebooks: ITag[] | undefined,
  updateTag: (tag : ITagWithChildren) => any,
  api: ServerAPI,
  sso: SynologySSO
}
