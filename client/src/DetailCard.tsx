import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import eventBus from "./EventBus";

import {
  CommandBar,
  DatePicker,
  defaultDatePickerStrings,
  Dropdown,
  IBasePickerSuggestionsProps,
  ICommandBarItemProps,
  Icon,
  IDatePicker,
  IDropdownOption,
  ITag,
  Shimmer,
  Stack,
  TagPicker,
  TextField,
} from "@fluentui/react";
import { TagContextMenu } from "./TagContextMenu";
import { Notebook, ServerAPI, Tag } from "./ServerAPI";

export const DetailCard: React.FunctionComponent<DetailCardProps> = (props) => {
  const datePickerRef = React.createRef<IDatePicker>();
  const [note, setNote] = useState<Note | undefined>();
  const [notebooks, setNotebooks] = useState<IDropdownOption[]>([]);
  const [modified, setModified] = useState<boolean>(false);

  useEffect(() => {
    loadNote();
  }, [props.noteId, props.availableTags]);

  useEffect(() => {
    setNotebooks(
      props.availableNotebooks?.map((t) => {
        return { key: t.key, text: t.name, data: { icon: selectIcon(t.type) } };
      }) ?? []
    );
  }, [props.availableNotebooks]);

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
      case "A":
        return "Archive";
      case "I":
        return "Inbox";
      case "D":
        return "Delete";
      default:
        return "BookAnswers";
    }
  };

  const loadNote = async () => {
    if (props.noteId) {
      const noteId = props.noteId;
      const data = await props.api?.loadNote(noteId);
      if (data) {
        const note: Note = {
          id: noteId,
          attachments: data.attachments,
          notebookId: data.notebookId,
          title: data.title ?? "",
          createTime: new Date(Date.parse(data.createTime)),
          tags: [],
          deleted: props.availableNotebooks?.find((n) => n.key == data.notebookId)?.type == "D",
          archived: props.availableNotebooks?.find((n) => n.key == data.notebookId)?.type == "A",
          parts: data.parts,
        };
        const tagNames = data.tags?.split(",") ?? [];
        const tagIds = data.tagIds?.split(",") ?? [];

        for (let i = 0; i < tagNames.length; i++) {
          note.tags.push({ name: tagNames[i], key: +tagIds[i] });
        }
        setNote(note);
      }
    }
  };

  const addNewTags = async (newTags: ITag[], callback: () => unknown, i = 0) => {
    if (newTags.length > i) {
      const key = await props.api?.newTag(newTags[i].name);
      if (key) {
        newTags[i].key = key;
        addNewTags(newTags, callback, i + 1);
      }
    } else {
      callback();
    }
  };

  const onTagsChanged = async (newTags: ITag[] | undefined) => {
    const newlyCreatedTags = newTags?.filter((t) => t.key == "-1") ?? [];
    if (newlyCreatedTags.length > 0) {
      addNewTags(newlyCreatedTags, () => onTagsChanged(newTags));
      eventBus.dispatch("note-collection-change", {});
    } else if (note && note.tags != newTags) {
      if (props.noteId) {
        const noteId = props.noteId;
        let removedTags: ITag[] = [];
        let addedTags: ITag[] = [];
        if (!newTags) {
          removedTags = note.tags;
        } else {
          removedTags = note.tags.filter((t) => newTags.filter((nt) => nt.key == t.key).length == 0);
          addedTags = newTags.filter((nt) => note?.tags.filter((t) => nt.key == t.key).length == 0);
        }
        addedTags.forEach(async (tag) => await props.api?.addTagToNote(noteId, +tag.key));
        removedTags.forEach(async (tag) => await props.api?.removeTagFromNote(noteId, +tag.key));
        eventBus.dispatch("note-collection-change", {
          tags: removedTags.map((t) => t.key).concat(addedTags.map((t) => t.key)),
        });
        setNote({ ...note, tags: newTags ?? [] });
      }
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined = undefined;
    if (modified && note) {
      timer = setTimeout(() => {
        console.log(`saving... ${note.title}`);
        updateNote(note);
        setModified(false);
        eventBus.dispatch("note-detail-change", props.noteId);
      }, 500);
    }
    return () => clearTimeout(timer);
  }, [note, modified]);

  const onTitleChanged = (_event: unknown, newValue: string | undefined) => {
    if (note && note?.title != newValue) {
      setNote({ ...note, title: newValue ?? "" });
      setModified(true);
    }
  };

  const onNotebookChanged = (_event: unknown, option?: IDropdownOption) => {
    if (option && note?.notebookId && note?.notebookId != option.key) {
      const newNote = { ...note, notebookId: +option.key };
      updateNote(newNote);
      setNote(newNote);
      eventBus.dispatch("note-collection-change", { notebooks: [newNote.notebookId, note.notebookId] });
    }
  };

  const purge = async () => {
    if (props.noteId) {
      await props.api?.purgeNote(props.noteId);
      eventBus.dispatch("note-collection-change", {
        notebooks: [note?.notebookId],
        tags: [note?.tags?.map((t) => t.key)],
      });
    }
  };

  const onDateChanged = (newValue: Date | null | undefined) => {
    if (newValue && note?.createTime && note?.createTime != newValue) {
      const newNote = { ...note, createTime: newValue };
      updateNote(newNote);
      setNote(newNote);
      eventBus.dispatch("note-detail-change", props.noteId);
    }
  };

  const updateNote = (note: Note) => {
    if (props.noteId) {
      props.api?.updateNote(props.noteId, {
        notebookId: note?.notebookId || 0,
        title: note?.title || "",
        createTime: format(note?.createTime || 0, "yyyy-MM-dd"),
      });
    }
  };

  const listContainsTagList = (tag: ITag, tagList?: ITag[]) => {
    if (!tagList || !tagList.length || tagList.length === 0) {
      return false;
    }
    return tagList.some((compareTag) => compareTag.key === tag.key);
  };

  const filterSuggestedTags = (filterText: string, tagList?: ITag[]): ITag[] => {
    let newTagList: ITag[] = [];
    if (!props.availableTags?.some((t) => t.name == filterText)) {
      newTagList = [{ key: "-1", name: filterText }];
    }
    return filterText
      ? [
          ...(props.availableTags?.filter(
            (tag) =>
              tag.name.toLowerCase().indexOf(filterText.toLowerCase()) === 0 && !listContainsTagList(tag, tagList)
          ) || []),
          ...newTagList,
        ]
      : [];
  };

  const pickerSuggestionsProps: IBasePickerSuggestionsProps = {
    suggestionsHeaderText: "Suggested tags",
    noResultsFoundText: "No tags found",
  };

  const getTextFromItem = (item: ITag) => item.name;

  const [doUpdate, setDoUpdate] = useState<{ target: Element; tag: Tag } | undefined>();

  const onShowContextualMenu = (ev: React.MouseEvent<HTMLElement>) => {
    const tagItem = (ev.target as HTMLElement).closest(".ms-TagItem");
    if (tagItem) {
      const textContent = tagItem.querySelector(".ms-TagItem-text")?.textContent;
      const found = props.availableTags?.find((t) => t.name == textContent);
      if (found) {
        ev.preventDefault();
        setDoUpdate({ target: tagItem, tag: found });
      }
    }
  };

  const onContextMenuDismiss = () => {
    setDoUpdate(undefined);
  };

  const download = (url: string, filename: string) => {
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        // Create blob link to download
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);

        // Append to html link element page
        document.body.appendChild(link);

        // Start download
        link.click();

        // Clean up and remove the link
        link.parentNode?.removeChild(link);
      });
  };

  async function split() {
    if (props.noteId) {
      await props.api?.split(props.noteId);
      eventBus.dispatch("note-collection-change", { notebooks: [note?.notebookId], tags: [note?.tags] });
    }
  }

  const detailCommands: ICommandBarItemProps[] = [
    {
      key: "archive",
      text: "Archive",
      iconProps: { iconName: "Archive" },
      hidden: note?.archived || note?.deleted,
      onClick: () =>
        onNotebookChanged(
          null,
          notebooks.find((n) => n.data.icon == "Archive")
        ),
    },
    {
      key: "restore",
      text: note?.archived ? "Unarchive" : "Undelete",
      iconProps: { iconName: "InboxCheck" },
      hidden: !note?.archived && !note?.deleted,
      onClick: () =>
        onNotebookChanged(
          null,
          notebooks.find((n) => n.data.icon == "Inbox")
        ),
    },
    {
      key: "delete",
      text: "Delete",
      iconProps: { iconName: "Delete" },
      hidden: note?.deleted,
      onClick: () =>
        onNotebookChanged(
          null,
          notebooks.find((n) => n.data.icon == "Delete")
        ),
    },
    {
      key: "purge",
      text: "Purge",
      iconProps: { iconName: "Delete" },
      hidden: !note?.deleted,
      onClick: () => purge(),
    },
    {
      key: "sep1",
      buttonStyles: { icon: "Separator" },
      hidden: (note?.parts || 0) == 0,
      iconProps: { iconName: "Separator" },
      disabled: true,
    },
    {
      key: "split",
      text: "Split",
      iconProps: { iconName: "Split" },
      hidden: (note?.parts || 0) == 0,
      onClick: () => split(),
    },
    {
      key: "sep2",
      buttonStyles: { icon: "Separator" },
      iconProps: { iconName: "Separator" },
      disabled: true,
    },
    {
      key: "moveNotebook",
      text: "Move",
      iconProps: { iconName: "FabricMovetoFolder" },
      subMenuProps: {
        items: notebooks.map((n) => {
          return {
            key: `${n.key}`,
            onClick: () => onNotebookChanged(null, n),
            text: n.text,
            iconProps: { iconName: n.data.icon },
          };
        }),
      },
    },
    {
      key: "addTag",
      text: "Modify Tags",
      iconProps: { iconName: "Tag" },
    },

    {
      key: "sep0",
      buttonStyles: { icon: "Separator" },
      iconProps: { iconName: "Separator" },
      hidden: !note?.attachments.length,
      disabled: true,
    },
    {
      key: "download",
      text: "Download",
      iconProps: { iconName: "DownloadDocument" },
      hidden: !note?.attachments.length,
      subMenuProps:
        (note?.attachments.length ?? 0) > 0
          ? {
              items:
                note?.attachments.map((a) => {
                  return {
                    key: "download" + a.fileName,
                    text: a.fileName,
                    iconProps: { iconName: "Attach" },
                    onClick: () => download(`/api/body/attachments/${a.uniqueFileName}`, a.fileName),
                  };
                }) || [],
            }
          : undefined,
    },
  ];

  return (
    <Stack className="DetailCard">
      <Shimmer className="DetailCardShimmer" isDataLoaded={note && props.noteId == note.id}>
        <CommandBar className="DetailsCommands" items={detailCommands} />
        <Stack horizontalAlign="stretch" verticalAlign="center" horizontal className="CardRow1">
          <span>Name:&nbsp;</span>
          <TextField value={note?.title || ""} className="TitleField" onChange={onTitleChanged} dir="auto" />
          <span>Date:&nbsp;</span>
          <DatePicker
            componentRef={datePickerRef}
            className="DateField"
            allowTextInput
            ariaLabel="Select a date"
            value={note?.createTime}
            onSelectDate={onDateChanged}
            strings={defaultDatePickerStrings}
          />
        </Stack>
        <Stack horizontal className="CardRow2" onContextMenu={onShowContextualMenu}>
          <Dropdown
            className="NotebookDropdown"
            options={notebooks}
            selectedKey={note?.notebookId}
            onChange={onNotebookChanged}
            onRenderOption={onRenderOption}
          />
          <TagPicker
            onResolveSuggestions={filterSuggestedTags}
            getTextFromItem={getTextFromItem}
            pickerSuggestionsProps={pickerSuggestionsProps}
            selectedItems={note?.tags}
            className="ItemTags"
            onChange={onTagsChanged}
          />
          <TagContextMenu
            updateTag={props.updateTag}
            availableTags={props.availableTags}
            doUpdate={doUpdate}
            onDismiss={onContextMenuDismiss}
            focusTag={props.focusTag}
          />
        </Stack>
      </Shimmer>
      <Shimmer isDataLoaded={note && props.noteId == note.id} className="BodyFieldShimmer">
        <iframe className="BodyField" src={props.api?.noteBodySrc(props.noteId)} />
      </Shimmer>
    </Stack>
  );
};

interface Note {
  id: number;
  attachments: [{ id: number; fileName: string; uniqueFileName: string }];
  notebookId: number;
  title: string;
  createTime: Date;
  tags: ITag[];
  deleted: boolean | undefined;
  archived: boolean | undefined;
  parts: number | undefined;
}

interface DetailCardProps {
  noteId: number | undefined;
  availableTags: Tag[] | undefined;
  availableNotebooks: Notebook[] | undefined;
  updateTag: (tag: Tag) => unknown;
  focusTag: (tag: Tag) => unknown;
  api?: ServerAPI;
}
