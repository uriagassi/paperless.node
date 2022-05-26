import React, {useEffect, useState} from "react";
import {INavLink, INavLinkGroup, ITag, Nav} from "@fluentui/react";
import {TagContextMenu} from "./TagContextMenu";

export const TagList: React.FunctionComponent<{
  selectedId: string | undefined,
  onSelectedIdChanged: (key?: string) => void,
  tags: ITagWithChildren[] | undefined,
  notebooks: ITagWithChildren[] | undefined, updateTag: (tag : ITagWithChildren) => any }> =
    (props: { selectedId: string | undefined, onSelectedIdChanged: (key?: string) => void, tags: ITagWithChildren[] | undefined,
      notebooks: ITagWithChildren[] | undefined, updateTag: (tag : ITagWithChildren) => any }) => {

  const [tagList, setTagList] = useState<INavLinkGroup[]>([])

  useEffect(() => {
    let links: INavLink[] = [];
    let tags: { [key: string]: INavLink } = {};
    let notebooks: INavLink[] = []
    props.tags?.forEach((tag: ITagWithChildren) => {
      tags[tag.key] = {
        key: 'tags/' + tag.key + '?',
        name: tag.name + (tag.notes ? " (" + tag.notes + ")" : ""),
        icon: 'Tag',
        isExpanded: tag.isExpanded,
        url: '#',
        links: []
      }
    });
    props.tags?.forEach(item => {
      let current = tags[item.key]
      if (item.parent == 0) {
        links.push(current);
      } else {
        tags['' + (item.parent ?? '')]?.links?.push(current)
      }
    });
    props.notebooks?.forEach((n: ITagWithChildren) => {
      notebooks.push({
        key: 'notebooks/' + n.key + '?',
        name: n.name + (n.notes ? " (" + n.notes + ")" : ""),
        icon: n.type == 'D' ? "Delete" : "Inbox"
      } as INavLink)
    })
    let selectedId = props.selectedId || notebooks[0]?.key
    if (selectedId != props.selectedId) {
      props.onSelectedIdChanged(selectedId);
    }
    setTagList([
      {
        name: "Notebooks",
        links: notebooks
      }, {
        name: 'Tags',
        links: links,
      }]);
  }, [props.tags, props.notebooks])

  const onSelect = (ev?: React.MouseEvent<HTMLElement>, item?: INavLink) => {
    props.onSelectedIdChanged(item?.key)
  }

  const [doUpdate, setDoUpdate] = useState<{target: Element, tag: ITagWithChildren} | undefined>();

  const onContextMenuDismiss = () => {
    setDoUpdate(undefined);
  }

      const onShowContextualMenu = (ev: React.MouseEvent<HTMLElement>) => {
        let tagItem = (ev.target as HTMLElement).closest('.ms-Button-flexContainer')
        console.log(tagItem ?? ev.target)
        if (tagItem) {
          if (tagItem.querySelector('.ms-Icon')?.attributes?.getNamedItem('data-icon-name')?.textContent == 'Tag') {
            const textContent = tagItem.querySelector('.ms-Nav-linkText')?.textContent?.match(/(.*?)( \(\d+\))?$/)
            console.log(textContent)
            if (textContent) {
              const found = props.tags?.find(t => t.name == textContent[1]);
              if (found) {
                ev.preventDefault();
                setDoUpdate({target: tagItem, tag: found as ITagWithChildren})
              }
            }
          }
        }
      }

  return (
      <div className='TagList' onContextMenu={onShowContextualMenu}>
        <Nav
            selectedKey={props.selectedId}
            groups={tagList ?? []}
            onLinkClick={onSelect}
        />
        <TagContextMenu updateTag={props.updateTag} availableTags={props.tags} doUpdate={doUpdate} onDismiss={onContextMenuDismiss}/>
      </div>
  );
}

export interface ITagWithChildren extends ITag {
  notes: number;
  parent?: number;
  isExpanded?: boolean;
  type?: string;
}
