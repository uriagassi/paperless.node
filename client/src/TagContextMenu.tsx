import React, { useEffect, useState } from "react";
import { ContextualMenu, ITag } from "@fluentui/react";
import { Tag } from "./ServerAPI";

interface TagContextMenuProps {
  updateTag: (tag: Tag) => unknown;
  focusTag?: (tag: Tag) => unknown;
  deleteTag?: (tag: Tag) => unknown;
  availableTags: ITag[] | undefined;
  doUpdate:
    | {
        target: Element;
        tag: Tag;
      }
    | undefined;
  onDismiss: () => unknown;
}

export const TagContextMenu: React.FunctionComponent<TagContextMenuProps> = (props) => {
  const [contextualMenuTarget, setContextualMenuTarget] = React.useState<Element | undefined>();
  const [showContextualMenu, setShowContextualMenu] = React.useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | undefined>();
  useEffect(() => {
    if (!showContextualMenu) {
      props.onDismiss();
    }
  }, [showContextualMenu]);

  useEffect(() => {
    if (props.doUpdate) {
      setSelectedTag(props.doUpdate.tag);
      setContextualMenuTarget(props.doUpdate.target);
      setShowContextualMenu(true);
    }
  }, [props.doUpdate]);
  const onHideContextualMenu = React.useCallback(() => setShowContextualMenu(false), []);
  const updateCurrentTag = React.useCallback(() => {
    onHideContextualMenu();
    console.log(selectedTag);
    if (selectedTag) {
      props.updateTag(selectedTag);
    }
  }, [selectedTag]);

  const focusOnCurrentTag = React.useCallback(() => {
    onHideContextualMenu();
    console.log(selectedTag);
    if (selectedTag) {
      props.focusTag?.(selectedTag);
    }
  }, [selectedTag]);

  const deleteCurrentTag = React.useCallback(() => {
    onHideContextualMenu();
    if (selectedTag) {
      props.deleteTag?.(selectedTag);
    }
  }, [selectedTag]);

  return (
    <ContextualMenu
      items={[
        { key: "rename", text: "Update...", onClick: () => updateCurrentTag() },
        { key: "focus", text: "Focus", onClick: () => focusOnCurrentTag(), hidden: !props.focusTag },
        { key: "delete", text: "Delete Tag", onClick: () => deleteCurrentTag(), hidden: !props.deleteTag },
      ]}
      hidden={!showContextualMenu}
      target={contextualMenuTarget}
      onDismiss={onHideContextualMenu}
    />
  );
};
