import React from "react";
import { CommandBar, ICommandBarItemProps, Stack } from "@fluentui/react";
import eventBus from "./EventBus";
import { ITagWithChildren } from "./TagList";

export const MultiNoteScreen: React.FunctionComponent<{
  selectedNotes: Set<number>;
  availableNotebooks: ITagWithChildren[] | undefined;
  filterId: string | undefined;
  activeNote?: number;
}> = (props) => {
  function currentUpdated() {
    const affectedList = { notebooks: [3], tags: [0] };
    if (props.filterId) {
      if (props.filterId.split("/")[0] == "notebooks") {
        affectedList.notebooks.push(+props.filterId.split("/")[1]);
      } else {
        affectedList.tags = [+props.filterId.split("/")[1]];
      }
    }
    eventBus.dispatch("note-collection-change", affectedList);
  }

  const doMove = (notebook: string | number | undefined) => {
    if (notebook) {
      const requestOptions = {
        method: "POST",
      };
      fetch(`api/notes/${Array.from(props.selectedNotes).join(",")}/notebook/${notebook}`, requestOptions).then(() => {
        const affectedList = { notebooks: [notebook], tags: [0] };
        if (props.filterId) {
          if (props.filterId.split("/")[0] == "notebooks") {
            affectedList.notebooks.push(+props.filterId.split("/")[1]);
          } else {
            affectedList.tags = [+props.filterId.split("/")[1]];
          }
        }
        eventBus.dispatch("note-collection-change", affectedList);
      });
    }
  };

  const doMerge = () => {
    console.log(props.selectedNotes);
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: Array.from(props.selectedNotes),
        toNote: props.activeNote,
      }),
    };
    fetch(`api/notes/${props.activeNote}/merge`, requestOptions).then(() => {
      currentUpdated();
    });
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
              onClick: () => doMerge(),
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
                      key: n.key,
                      text: n.name,
                      iconProps: { iconName: "Inbox" },
                      onClick: () => doMove(n.key),
                    } as ICommandBarItemProps;
                  }) ?? [],
              },
            },
          ]}
        />
      </Stack>
      <div style={{ flex: 1 }} />
    </>
  );
};
