import React, {useEffect, useState} from "react";
import {ITagWithChildren} from "./TagList";
import {ContextualMenu, ITag} from "@fluentui/react";

export const TagContextMenu: React.FunctionComponent<
    { updateTag: (tag : ITagWithChildren) => any, availableTags: ITag[] | undefined, doUpdate : {target: Element, tag: ITagWithChildren} | undefined, onDismiss: () => any  }> =
    (props) => {
          const [contextualMenuTarget, setContextualMenuTarget] = React.useState<Element | undefined>()
          const [showContextualMenu, setShowContextualMenu] = React.useState(false);
      const [selectedTag, setSelectedTag] = useState<ITagWithChildren | undefined>()
      useEffect(() => {
        if (!showContextualMenu) {
          props.onDismiss()
        }
      }, [showContextualMenu])

      useEffect(() => {
        if (props.doUpdate) {
          setSelectedTag(props.doUpdate.tag);
          setContextualMenuTarget(props.doUpdate.target);
          setShowContextualMenu(true);
        }
      }, [props.doUpdate])
          const onHideContextualMenu = React.useCallback(() => setShowContextualMenu(false), []);
          const updateCurrentTag = React.useCallback(() => {
                onHideContextualMenu()
                console.log(selectedTag)
                if (selectedTag) {
                      props.updateTag(selectedTag)
                }
          }, [selectedTag])


          return <ContextualMenu
          items={[{key: 'rename', text: 'Update...', onClick: () => updateCurrentTag()}]}
          hidden={!showContextualMenu}
          target={contextualMenuTarget}
          onDismiss={onHideContextualMenu}
      />;

}
