import React, {useEffect, useState} from "react";
import {ITagWithChildren} from "./TagList";
import {ContextualMenu, ITag} from "@fluentui/react";

export const TagContextMenu: React.FunctionComponent<
    { updateTag: (tag : ITagWithChildren) => any, availableTags: ITag[] | undefined, doUpdate : {target: Element, tag: ITagWithChildren} | undefined, onDismiss: () => any  }> =
    (props: { updateTag: (tag : ITagWithChildren) => any, availableTags: ITag[] | undefined, doUpdate : {target: Element, tag: ITagWithChildren} | undefined, onDismiss: () => any}) => {
          const [contextualMenuTarget, setContextualMenuTarget] = React.useState<Element | undefined>()
          const [showContextualMenu, setShowContextualMenu] = React.useState(false);
      const [selectedTag, setSelectedTag] = useState<ITagWithChildren | undefined>()
          const onShowContextualMenu = (ev: React.MouseEvent<HTMLElement>) => {
                let tagItem = (ev.target as HTMLElement).closest('.ms-TagItem')
                if (tagItem) {
                      const textContent = tagItem.querySelector('.ms-TagItem-text')?.textContent;
                      console.log(textContent)
                      const found = props.availableTags?.find(t => t.name == textContent);
                      console.log(found)
                      setSelectedTag(found as ITagWithChildren)
                      ev.preventDefault(); // don't navigate
                      setContextualMenuTarget(tagItem)
                      setShowContextualMenu(true);
                }
          };

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
