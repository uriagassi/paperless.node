import React from "react";
import { CommandBar, ICommandBarItemProps, Stack } from "@fluentui/react";
import eventBus from "./EventBus";
import { NoteCollectionChange } from "./NoteList";
import { Notebook, ServerAPI } from "./ServerAPI";

export const MultiNoteScreen: React.FunctionComponent<{
  selectedNotes: Set<number>;
  availableNotebooks: Notebook[] | undefined;
  filterId: string | undefined;
  activeNote?: number;
  api: ServerAPI | undefined;
}> = (props) => {
  function currentUpdated() {
    const affectedList: NoteCollectionChange = { notebooks: ["D"] };
    if (props.filterId) {
      if (props.filterId.split("/")[0] == "notebooks") {
        affectedList.notebooks?.push(+props.filterId.split("/")[1]);
      } else {
        affectedList.tags = [+props.filterId.split("/")[1]];
      }
    }
    eventBus.dispatch("note-collection-change", affectedList);
  }

  const doMove = async (notebook: string | number | undefined) => {
    if (notebook) {
      await props.api?.move(notebook, ...props.selectedNotes);
      const affectedList: NoteCollectionChange = { notebooks: [notebook] };
      if (props.filterId) {
        if (props.filterId.split("/")[0] == "notebooks") {
          affectedList.notebooks?.push(+props.filterId.split("/")[1]);
        } else {
          affectedList.tags = [+props.filterId.split("/")[1]];
        }
      }
      eventBus.dispatch("note-collection-change", affectedList);
    }
  };

  const doMerge = async () => {
    if (props.activeNote) {
      console.log(props.selectedNotes);
      await props.api?.mergeInto(props.activeNote, Array.from(props.selectedNotes));
      currentUpdated();
    }
  };

  const doDownloadAll = async () => {
    await props.api?.getAllAttachments([...props.selectedNotes]).then((response) => props.api?.download(response));
  };

  return (
    <>
      <div style={{ flex: 1 }} />
      <Stack className="MultiNote" horizontalAlign="center" verticalAlign="center">
        <img className="MultiFolderIcon" src={"multipleNotes.svg"} />
        <CommandBar
          items={[
            {
              key: "merge",
              text: "Merge Items",
              iconProps: { iconName: "Merge" },
              onClick: () => {
                doMerge();
              },
            },
            {
              key: "delete",
              text: "Delete " + props.selectedNotes.size + " Notes",
              iconProps: { iconName: "Delete" },
              onClick: () => doMove(props.availableNotebooks?.find((n) => n.type == "D")?.key),
            },
            {
              key: "move",
              text: "Move " + props.selectedNotes.size + " Notes...",
              iconProps: { iconName: "Folder" },
              subMenuProps: {
                items:
                  props.availableNotebooks?.map((n) => {
                    return {
                      key: "" + n.key,
                      text: n.name,
                      iconProps: { iconName: "Inbox" },
                      onClick: () => {
                        doMove(n.key);
                      },
                    } as ICommandBarItemProps;
                  }) ?? [],
              },
            },
            {
              key: "download",
              text: "Download All Attachments",
              iconProps: { iconName: "Attach" },
              onClick: () => {
                doDownloadAll();
              },
            },
          ]}
        />
      </Stack>
      <div style={{ flex: 1 }} />
    </>
  );
};
