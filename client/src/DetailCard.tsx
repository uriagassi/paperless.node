import React, {useEffect, useState} from "react";
import {format} from "date-fns";
import eventBus from "./EventBus";

import {
  CommandBar,
  DatePicker,
  defaultDatePickerStrings,
  Dropdown,
  IBasePickerSuggestionsProps, ICommandBarItemProps, Icon,
  IDatePicker,
  IDropdownOption, ITag,
  Stack,
  TagPicker,
  TextField
} from "@fluentui/react";
import {ITagWithChildren} from "./TagList";
import {TagContextMenu} from "./TagContextMenu";
import {ServerAPI} from "./ServerAPI";
import {ISSO} from "./sso/ISSO";

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
          return {key: t.key, text: t.name, data: { icon: selectIcon(t.type)}}
        }) ?? [])
      }, [props.availableNotebooks])

      const onRenderOption = (option?: IDropdownOption): JSX.Element => {
        return (
            <div>
              {option?.data && option.data.icon && (
                  <Icon iconName={option.data.icon} aria-hidden="true" title={option.data.icon} />
              )}
              <span>{option?.text}</span>
            </div>
        );
      };
      const selectIcon = (type: string | undefined) => {
        switch (type) {
          case 'A':
            return 'Archive'
          case 'I':
            return 'Inbox'
          case 'D':
            return 'Delete'
          default:
            return "BookAnswers"
        }
      }

      const loadNote = () => {
        if (props.noteId) {
          props.api.loadNote(props.noteId)
              .then(data => {
                let note: Note = {
                  attachments: data.attachments,
                  notebookId: data.notebookId,
                  title: data.title ?? '',
                  createTime: new Date(Date.parse(data.createTime)),
                  tags: [],
                  deleted: props.availableNotebooks?.find(n => n.key == data.notebookId)?.type == 'D',
                  archived: props.availableNotebooks?.find(n => n.key == data.notebookId)?.type == 'A'
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

      const download = (url: string, filename: string) => {
        fetch(url)
            .then((response) => response.blob())
            .then((blob) => {
              // Create blob link to download
              const url = window.URL.createObjectURL(
                  new Blob([blob]),
              );
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute(
                  'download',
                  filename,
              );

              // Append to html link element page
              document.body.appendChild(link);

              // Start download
              link.click();

              // Clean up and remove the link
              link.parentNode?.removeChild(link);
            });
      }

      const detailCommands: ICommandBarItemProps[] = [

        { key: 'archive',
        text: 'Archive',
        iconProps: { iconName: 'Archive' },
          hidden: note?.archived || note?.deleted,
        onClick: () => onNotebookChanged(null, notebooks.find(n => n.data.icon == 'Archive'))},
        { key: 'restore',
          text: note?.archived ? 'Unarchive' : 'Undelete',
          iconProps: { iconName: 'InboxCheck' },
          hidden: !note?.archived && !note?.deleted,
          onClick: () => onNotebookChanged(null, notebooks.find(n => n.data.icon == 'Inbox'))},
        {key: 'delete',
          text: 'Delete',
          iconProps: { iconName: 'Delete'},
          hidden: note?.deleted,
          onClick: () => onNotebookChanged(null, notebooks.find(n => n.data.icon == 'Delete')),
        split: true,},
        { key: 'sep1',
          buttonStyles: {icon: 'Separator'},
         iconProps: { iconName: 'Separator'},
        disabled: true},
        { key: 'split',
        text: 'Split',
        iconProps: { iconName: 'Split'},
        disabled: true},
        { key: 'sep2',
          buttonStyles: {icon: 'Separator'},
          iconProps: { iconName: 'Separator'},
          disabled: true},
        { key: 'moveNotebook',
        text: 'Move',
        iconProps: {iconName: 'FabricMovetoFolder'},
          subMenuProps: { items: notebooks.map(n => { return {
            key: `${n.key}`,
              onClick: () => onNotebookChanged(null, n),
            text: n.text,
              iconProps: { iconName: n.data.icon }
            }})}
        },
        { key: 'addTag',
        text: 'Modify Tags',
        iconProps: { iconName: 'Tag'}},

        { key: 'sep0',
          buttonStyles: {icon: 'Separator'},
          iconProps: { iconName: 'Separator'},
          hidden: !note?.attachments.length,
          disabled: true},
        {key: 'download',
          text: 'Download',
          iconProps: { iconName: 'DownloadDocument'},
          hidden: !note?.attachments.length,
          split: true,
          subMenuProps: (note?.attachments.length ?? 0) > 0 ? {
            items: note?.attachments.map(a => {return {
              key: 'download' + a.filename,
              text: a.filename,
              iconProps: { iconName: 'Attach'},
              onClick: () => download(`/api/body/attachments/${a.uniqueFilename}`, a.filename),
            }}) || []} : undefined
        },
      ]

      return <Stack className='DetailCard'>
        <CommandBar className='DetailsCommands' items={detailCommands}/>
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
                    selectedKey={note?.notebookId} onChange={onNotebookChanged} onRenderOption={onRenderOption}/>
          <TagPicker onResolveSuggestions={filterSuggestedTags}
                     getTextFromItem={getTextFromItem}
                     pickerSuggestionsProps={pickerSuggestionsProps}
                     selectedItems={note?.tags} className="ItemTags"
                     onChange={onTagsChanged}/>
          <TagContextMenu updateTag={props.updateTag} availableTags={props.availableTags} doUpdate={doUpdate} onDismiss={onContextMenuDismiss}/>
        </Stack>
        <iframe className='BodyField'
                src={props.sso?.authenticate(props.noteId ? ('/api/body/' + props.noteId) : 'text.html')}/>
      </Stack>;

    }

interface Note {
  attachments: [{id: number, filename: string, uniqueFilename: string}]
  notebookId: number;
  title: string;
  createTime: Date;
  tags: ITag[];
  deleted: boolean | undefined;
  archived: boolean | undefined;
}

interface DetailCardProps {
  noteId: number | undefined,
  availableTags: ITag[] | undefined,
  availableNotebooks: ITagWithChildren[] | undefined,
  updateTag: (tag : ITagWithChildren) => any,
  api: ServerAPI,
  sso: ISSO | undefined
}
