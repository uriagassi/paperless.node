import React, { createRef, useEffect, useState } from "react";
import {
  ContextualMenu,
  DefaultButton,
  Dialog,
  DialogFooter,
  INavLink,
  INavLinkGroup,
  ITag,
  IDialogContentProps,
  Nav,
  PrimaryButton,
  Shimmer,
  DialogType,
} from "@fluentui/react";
import { TagContextMenu } from "./TagContextMenu";
import { AddNotebookDialog } from "./AddNotebookDialog";
import { useBoolean } from "@fluentui/react-hooks";
import eventBus from "./EventBus";
import { Folder } from "./NoteList";

interface TagListProps {
  selectedId: Folder | undefined;
  onSelectedIdChanged: (key?: Folder) => void;
  tags: ITagWithChildren[] | undefined;
  notebooks: ITagWithChildren[] | undefined;
  updateTag: (tag: ITagWithChildren) => unknown;
}

export const TagList: React.FunctionComponent<TagListProps> = (props) => {
  const [tagList, setTagList] = useState<INavLinkGroup[]>([]);
  const [showArchiveContext, setShowArchiveContext] = useState<Element>();
  const [showTrashContext, setShowTrashContext] = useState<Element>();
  const [showDeleteNotebookContext, setShowDeleteNotebookContext] = useState<
    { target: Element; tag: ITagWithChildren } | undefined
  >();
  const [addNotebook, { toggle: toggleAddNotebook }] = useBoolean(false);
  const tagListRef = createRef<HTMLDivElement>();

  function addToNotebooks(
    notebooks: INavLink[],
    n: ITagWithChildren | string,
    icon: string,
    callback?: (l: INavLink) => unknown
  ) {
    const notebook = typeof n === "string" ? props.notebooks?.find((i) => i.type === n) : n;
    if (notebook) {
      const link = {
        url: "#",
        key: "notebooks/" + notebook.key + "?",
        name: notebook.name + (notebook.notes ? " (" + notebook.notes + ")" : ""),
        icon: icon,
        itag: n,
      } as INavLink;
      callback?.(link);
      notebooks.push(link);
    }
  }

  useEffect(() => {
    const links: INavLink[] = [];
    const tags: { [key: string]: INavLink } = {};
    const notebooks: INavLink[] = [];
    props.tags?.forEach((tag: ITagWithChildren) => {
      tags[tag.key] = {
        key: "tags/" + tag.key + "?",
        name: tag.name + (tag.notes ? " (" + tag.notes + ")" : ""),
        icon: "Tag",
        isExpanded: tag.isExpanded,
        url: "#",
        links: [],
        itag: tag,
      };
    });
    props.tags?.forEach((item) => {
      const current = tags[item.key];
      if (item.parent == 0) {
        links.push(current);
      } else {
        tags["" + (item.parent ?? "")]?.links?.push(current);
      }
    });
    addToNotebooks(notebooks, "I", "Inbox");
    addToNotebooks(
      notebooks,
      "A",
      "Archive",
      (n) => (n.isExpanded = tagList?.[0]?.links?.find((l) => l.icon == "Archive")?.isExpanded ?? true)
    );
    if (notebooks.length > 0) {
      const customNotebookLinks: INavLink[] = [];
      props.notebooks?.filter((n) => !n.type).forEach((n) => addToNotebooks(customNotebookLinks, n, "BookAnswers"));
      notebooks[notebooks.length - 1].links = customNotebookLinks;
    }
    addToNotebooks(notebooks, "D", "Delete");
    const selectedId =
      props.selectedId || notebooks.length === 0
        ? undefined
        : { filterId: notebooks[0].key, type: notebooks[0].type as string };
    if (selectedId != props.selectedId && selectedId?.filterId) {
      props.onSelectedIdChanged(selectedId);
    }
    setTagList([
      {
        name: "Notebooks",
        links: notebooks,
      },
      {
        name: "Tags",
        links: links,
      },
    ]);
  }, [props.tags, props.notebooks]);

  const onSelect = (ev?: React.MouseEvent<HTMLElement>, item?: INavLink) => {
    const notebook = item?.itag as ITagWithChildren;
    props.onSelectedIdChanged({ filterId: item?.key, type: notebook?.type });
  };

  const [dialogData, setDialogData] = useState<{ props: IDialogContentProps; callback: () => unknown }>();

  const onDeleteTag = (tag: ITagWithChildren) => {
    if (tag.notes > 0) {
      setDialogData({
        props: {
          type: DialogType.normal,
          title: `Delete tag ${tag.name}`,
          subText: `Tag will be removed from all notes`,
        },
        callback: () => {
          setDialogData(undefined);
          doDeleteTag(tag);
        },
      });
    } else {
      doDeleteTag(tag);
    }
  };

  const doDeleteTag = (tag: ITagWithChildren) => {
    fetch(`/api/tags/${tag.key}`, { method: "DELETE" }).then(() => {
      eventBus.dispatch("note-collection-change", { tags: [tag.key] });
    });
  };

  const onDeleteNotebook = () => {
    if (showDeleteNotebookContext) {
      const notebook = showDeleteNotebookContext.tag;
      if (notebook.notes > 0) {
        setDialogData({
          props: {
            type: DialogType.normal,
            title: `Delete notebook ${notebook.name}`,
            subText: `Notes from this notebook will be sent to Inbox`,
          },
          callback: () => {
            setDialogData(undefined);
            doDeleteNotebook(notebook);
          },
        });
      } else {
        doDeleteNotebook(notebook);
      }
    }
  };

  const doDeleteNotebook = (notebook: ITagWithChildren) => {
    fetch(`/api/notebooks/${notebook.key}`, { method: "DELETE" }).then(() => {
      eventBus.dispatch("note-collection-change", { notebooks: [notebook.key] });
    });
  };

  useEffect(() => {
    if (props.selectedId && tagList.length > 1) {
      if (checkExpanded(tagList[1].links)) {
        setTagList([...tagList]);
      }
    }
  }, [props.selectedId]);

  useEffect(() => {
    if (props.selectedId) {
      tagListRef.current?.querySelector(".is-selected")?.scrollIntoView(false);
    }
  }, [tagList]);

  function checkExpanded(links: INavLink[]): boolean {
    const selectedLink = links.find((l) => l.key == props.selectedId);
    if (selectedLink) {
      return true;
    }
    const parentLink = links.find((l) => l.links && checkExpanded(l.links));
    if (parentLink) {
      console.log(`expanding ${parentLink.name}`);
      parentLink.isExpanded = true;
      return true;
    }
    return false;
  }

  const [doUpdate, setDoUpdate] = useState<{ target: Element; tag: ITagWithChildren } | undefined>();

  const onContextMenuDismiss = () => {
    setDoUpdate(undefined);
  };

  const onShowContextualMenu = (ev: React.MouseEvent<HTMLElement>) => {
    const tagItem = (ev.target as HTMLElement).closest(".ms-Button-flexContainer");
    if (tagItem) {
      const iconName = tagItem.querySelector(".ms-Icon")?.attributes?.getNamedItem("data-icon-name")?.textContent;
      const textContent = tagItem.querySelector(".ms-Nav-linkText")?.textContent?.match(/(.*?)( \(\d+\))?$/);
      switch (iconName) {
        case "Tag":
          console.log(textContent);
          if (textContent) {
            const found = props.tags?.find((t) => t.name == textContent[1]);
            if (found) {
              ev.preventDefault();
              setDoUpdate({ target: tagItem, tag: found as ITagWithChildren });
            }
          }
          break;
        case "Archive":
          ev.preventDefault();
          setShowArchiveContext(tagItem);
          break;
        case "Delete":
          ev.preventDefault();
          setShowTrashContext(tagItem);
          break;
        case "BookAnswers":
          if (textContent) {
            const found = props.notebooks?.find((t) => t.name == textContent[1]);
            if (found) {
              ev.preventDefault();
              setShowDeleteNotebookContext({ target: tagItem, tag: found });
            }
          }
      }
    }
  };

  function onExpand(ev?: React.MouseEvent<HTMLElement, MouseEvent>, item?: INavLink) {
    if (item) {
      fetch(`/api/${item.key?.replace("?", "/")}expand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expanded: `${!item.isExpanded}` }),
      }).then((r) => console.log(r));
    }
  }

  function emptyTrash() {
    eventBus.dispatch("wait-screen", "Emptying Trash...");
    fetch("api/trash", { method: "DELETE" }).then(() => {
      eventBus.dispatch("note-collection-change", { notebooks: ["D"] });
      eventBus.dispatch("wait-screen", undefined);
    });
  }

  return (
    <div className="TagList" onContextMenu={onShowContextualMenu} ref={tagListRef}>
      <Shimmer isDataLoaded={!!props.tags}>
        <Nav
          selectedKey={props.selectedId?.filterId}
          groups={tagList ?? []}
          onLinkClick={onSelect}
          onLinkExpandClick={onExpand}
        />
      </Shimmer>
      <TagContextMenu
        updateTag={props.updateTag}
        availableTags={props.tags}
        doUpdate={doUpdate}
        onDismiss={onContextMenuDismiss}
        deleteTag={onDeleteTag}
      />
      <ContextualMenu
        items={[
          {
            key: "add-notebook",
            text: "Add Notebook...",
            onClick: toggleAddNotebook,
            iconProps: { iconName: "BookAnswers" },
          },
        ]}
        hidden={!showArchiveContext}
        target={showArchiveContext}
        onDismiss={() => setShowArchiveContext(undefined)}
      />
      <ContextualMenu
        items={[{ key: "empty-trash", text: "Empty...", onClick: emptyTrash, iconProps: { iconName: "Trash" } }]}
        hidden={!showTrashContext}
        target={showTrashContext}
        onDismiss={() => setShowTrashContext(undefined)}
      />
      <ContextualMenu
        items={[
          {
            key: "delete-notebook",
            text: "Delete Notebook",
            onClick: onDeleteNotebook,
            iconProps: { iconName: "Trash" },
          },
        ]}
        hidden={!showDeleteNotebookContext}
        target={showDeleteNotebookContext?.target}
        onDismiss={() => setShowDeleteNotebookContext(undefined)}
      />
      <AddNotebookDialog show={addNotebook} availableNotebooks={props.notebooks} onClose={toggleAddNotebook} />
      <Dialog hidden={!dialogData} onDismiss={() => setDialogData(undefined)} dialogContentProps={dialogData?.props}>
        <DialogFooter>
          <PrimaryButton onClick={dialogData?.callback} text="Delete" />
          <DefaultButton onClick={() => setDialogData(undefined)} text="Cancel" />
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export interface ITagWithChildren extends ITag {
  notes: number;
  parent?: number;
  isExpanded?: boolean;
  type?: string;
}
