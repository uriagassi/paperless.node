import React, { useEffect, useState } from "react";
import {
  CommandBarButton,
  DocumentCard,
  DocumentCardDetails,
  DocumentCardLogo,
  DocumentCardTitle,
  DocumentCardType,
  FocusZone,
  Icon,
  Shimmer,
  ShimmerElementsGroup,
  ShimmerElementType,
  Stack,
} from "@fluentui/react";
import eventBus from "./EventBus";
import { Note, ServerAPI } from "./ServerAPI";

function formatFileSize(bytes: number, decimalPoint?: number) {
  if (bytes == 0) return "0 Bytes";
  const k = 1000,
    dm = decimalPoint || 2,
    sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

const fileTypeToIcon: { [key: string]: string } = {
  "image/jpeg": "FileImage",
  "image/png": "FileImage",
  "application/pdf": "PDF",
  text: "TextDocument",
  "application/zip": "ZipFolder",
};
export const NoteList: React.FunctionComponent<NoteListProps> = (props) => {
  const [noteList, setNoteList] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    const eventLoadNotes = () => loadNotes(false);
    eventBus.on("note-detail-change", eventLoadNotes);
    return () => {
      eventBus.remove("note-detail-change", eventLoadNotes);
    };
  }, [props.selectedFolder, props.searchTerm, props.selectedId, props.limit, props.onSelectedIdChanged]);

  useEffect(() => {
    const eventCheckChange = (e: CustomEvent<NoteCollectionChange>) => checkChange(e.detail);
    eventBus.on("note-collection-change", eventCheckChange);
    return () => {
      eventBus.remove("note-collection-change", eventCheckChange);
    };
  }, [props.selectedFolder]);

  useEffect(() => {
    loadNotes();
  }, [props.selectedFolder, props.searchTerm]);

  useEffect(() => {
    console.log("selecting note " + props.selectedId + "(" + Array.from(props.selectedNotes) + ")");
    selectNote();
  }, [props.selectedId, props.selectedNotes]);

  const selectNote = () => {
    const newNotes = [...noteList];
    noteList.forEach((n: Note) => {
      n.active = props.selectedId == n.id;
      n.selected = props.selectedNotes?.has(n.id);
    });
    setNoteList(newNotes);
  };

  const loadNotes = (withSetLoading = true) => {
    if (props.selectedFolder?.filterId || props.searchTerm) {
      if (withSetLoading) {
        setLoading(true);
      }
      let filter = props.selectedFolder?.filterId ?? "";
      if (props.searchTerm ?? "" != "") {
        filter = "search?term=" + encodeURIComponent(props.searchTerm ?? "") + "&";
      }
      props.api.loadNotes(filter, props.limit).then((data) => {
        const notes: Note[] = [];
        let selectedFound = false;
        data.notes.forEach((n: Note) => {
          let attachments = n.attachments;
          const count = n.attachments?.match(/,/g)?.length || 0;
          if (count > 0) {
            attachments = "" + (count + 1) + " attachments";
          }
          selectedFound = selectedFound || props.selectedId == n.id;
          notes.push({ ...n, attachments: attachments, active: props.selectedId == n.id });
        });
        setNoteList(notes);
        if (withSetLoading) {
          setLoading(false);
        }
        if (!selectedFound && data.notes.length > 0) {
          props.onSelectedIdChanged?.(data.notes[0].id, new Set([data.notes[0].id]));
        }
      });
    } else {
      console.log("clearing list");
      setNoteList([]);
    }
  };

  const checkChange = (data: NoteCollectionChange) => {
    if (props.selectedFolder?.filterId?.startsWith("notebook")) {
      if (
        data.notebooks?.filter(
          (n) => props.selectedFolder?.filterId == "notebooks/" + n + "?" || props.selectedFolder?.type == n
        )
      ) {
        loadNotes(false);
      }
    } else if (props.selectedFolder?.filterId?.startsWith("tag")) {
      if (data.tags?.filter((n) => props.selectedFolder?.filterId == "tags/" + n + "?")) {
        loadNotes(false);
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, id: number) => {
    if (e.key == "Delete") {
      deleteNote(id);
    }
  };

  const deleteNote = (id: number) => {
    const requestOptions = {
      method: "POST",
    };
    fetch(`api/notes/${id}/notebook/D`, requestOptions).then(() => {
      const affectedList = { notebooks: ["D"] } as NoteCollectionChange;
      if (props.selectedFolder?.filterId) {
        if (props.selectedFolder?.filterId.split("/")[0] == "notebooks") {
          affectedList.notebooks?.push(+props.selectedFolder?.filterId.split("/")[1]);
        } else {
          affectedList.tags = [+props.selectedFolder?.filterId.split("/")[1]];
        }
      }
      eventBus.dispatch("note-collection-change", affectedList);
    });
  };

  const onFocusChange = (note: Note) => {
    const noteId = note.id;
    const keyState = props.keyState;
    if (keyState && keyState.update > Date.now() - 5000) {
      if (keyState.ctrlKey || keyState.metaKey) {
        const index = props.selectedNotes?.has(noteId);
        const selected = new Set(props.selectedNotes);
        if (index) {
          selected.delete(noteId);
        } else {
          selected.add(noteId);
        }
        props.onSelectedIdChanged?.(noteId, selected);
      } else if (keyState.shiftKey) {
        if (props?.selectedId) {
          let startIndex = noteList.indexOf(note);
          let endIndex = noteList.findIndex((n) => n.id == props.selectedId);
          if (endIndex < startIndex) {
            [startIndex, endIndex] = [endIndex, startIndex];
          }
          console.log("range is [" + startIndex + "," + endIndex + ")");
          const selected = new Set(props.selectedNotes);
          console.log("finding range");
          if (startIndex > -1) {
            for (let i = startIndex; i <= endIndex; i++) {
              console.log("looking for id " + noteList[i].id + " [" + i + "]");
              if (!note.selected) {
                selected.add(noteList[i].id);
              } else {
                selected.delete(noteList[i].id);
              }
            }
            selected.add(noteId);
            console.log("setting selected " + selected);
            props.onSelectedIdChanged?.(noteId, selected);
          }
        }
      } else {
        props.onSelectedIdChanged?.(noteId, new Set([noteId]));
      }
    } else {
      props.onSelectedIdChanged?.(noteId, new Set([noteId]));
    }
  };
  const getCustomElements = (): JSX.Element => {
    return (
      <>
        {[...Array(10)].map((i) => (
          <div className="ListItem" key={`shimmer${i}`}>
            <ShimmerElementsGroup
              shimmerElements={[
                { type: ShimmerElementType.line, height: 100, width: 48 },
                { type: ShimmerElementType.gap, width: 16, height: 40 },
              ]}
            />
            <ShimmerElementsGroup
              flexWrap
              width="100%"
              shimmerElements={[{ type: ShimmerElementType.gap, width: "100%", height: 15 }]}
            />
          </div>
        ))}
      </>
    );
  };

  const notes = [];
  for (let i = 0; i < noteList.length; i++) {
    const note = noteList[i];
    let className = note.active ? "ListItem is-active" : "ListItem";
    if (note.selected) className += " is-selected";
    notes.push(
      <DocumentCard
        key={note.id}
        className={className}
        type={DocumentCardType.compact}
        onFocus={() => onFocusChange(note)}
        onKeyDown={(e) => onKeyDown(e, note.id)}
        data-is-focusable
      >
        <DocumentCardLogo logoIcon={fileTypeToIcon[note.mime ?? "text"] ?? "attach"} />
        <DocumentCardDetails>
          <DocumentCardTitle title={note.title} className="ListItemTitle" data-is-not-focusable />
          <DocumentCardTitle title={note.createTime.split(" ")[0]} showAsSecondaryTitle />
          {note.size && note.size > 0 ? (
            <div className="ms-DocumentCardStatus Attachments">
              <Icon iconName={fileTypeToIcon[note.mime] ?? "attach"} />
              <span className="AttachmentName">{note.attachments}</span>
              <span>{formatFileSize(note.size)}</span>
            </div>
          ) : (
            <div />
          )}
        </DocumentCardDetails>
      </DocumentCard>
    );
  }
  if (noteList.length >= (props.limit ?? 100)) {
    notes.push(<CommandBarButton text="More..." />);
  }
  return (
    <FocusZone className="ListView" style={props.style}>
      <Shimmer isDataLoaded={!loading} customElementsGroup={getCustomElements()} width="100%">
        <Stack
          tabIndex={props.tabIndex}
          key={props.selectedFolder?.filterId}
          horizontalAlign="start"
          verticalAlign="start"
        >
          {notes}
        </Stack>
      </Shimmer>
    </FocusZone>
  );
};

export interface KeyState {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  update: number;
}

export interface Folder {
  filterId: string | undefined;
  type?: string | undefined;
}

interface NoteListProps {
  style: { width: string | number };
  selectedFolder: Folder | undefined;
  selectedId?: number | undefined;
  onSelectedIdChanged?: (key: number, selectedKeys: Set<number>) => void;
  limit?: number;
  searchTerm: string | undefined;
  tabIndex: number | undefined;
  selectedNotes: Set<number>;
  keyState?: KeyState;
  api: ServerAPI;
}

export interface NoteCollectionChange {
  notebooks?: (number | string)[];
  tags?: number[];
}
