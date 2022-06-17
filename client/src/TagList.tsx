import React, {createRef, useEffect, useState} from "react";
import {
  INavLink,
  INavLinkGroup,
  ITag,
  Nav,
  Shimmer
} from "@fluentui/react";
import {TagContextMenu} from "./TagContextMenu";

export const TagList: React.FunctionComponent<{
  selectedId: string | undefined,
  onSelectedIdChanged: (key?: string) => void,
  tags: ITagWithChildren[] | undefined,
  notebooks: ITagWithChildren[] | undefined, updateTag: (tag : ITagWithChildren) => any }> =
    (props) => {

      const [tagList, setTagList] = useState<INavLinkGroup[]>([])
      const tagListRef = createRef<HTMLDivElement>()

      function addNote(notebooks: INavLink[], n: ITagWithChildren, icon: string) {
        notebooks.push({
          key: 'notebooks/' + n.key + '?',
          name: n.name + (n.notes ? " (" + n.notes + ")" : ""),
          icon: icon
        } as INavLink)
      }

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
        props.notebooks?.filter(n => n.type == 'I').forEach(n => addNote(notebooks, n, "Inbox"))
        props.notebooks?.filter(n => !n.type).forEach(n => addNote(notebooks, n, "BookAnswers"))
        props.notebooks?.filter(n => n.type == 'A').forEach(n => addNote(notebooks, n,  "Archive"))
        props.notebooks?.filter(n => n.type == 'D').forEach(n => addNote(notebooks, n, "Delete"))
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

      useEffect(() => {
        if (props.selectedId) {
          if (checkExpanded(tagList[1].links)) {
            setTagList([...tagList])
          }
        }
      }, [props.selectedId])

      useEffect(() => {
        if (props.selectedId) {
          tagListRef.current?.querySelector('.is-selected')?.scrollIntoView(false)
        }
      }, [tagList])

      function checkExpanded(links: INavLink[]) : boolean {
        const selectedLink = links.find(l => l.key == props.selectedId)
        if (selectedLink) {
          return true
        }
        const parentLink = links.find(l => l.links && checkExpanded(l.links))
        if (parentLink) {
          console.log(`expanding ${parentLink.name}`)
          parentLink.isExpanded = true
          return true
        }
        return false
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

      function onExpand(ev?: React.MouseEvent<HTMLElement, MouseEvent>, item?: INavLink) {
        if (item) {
          fetch(`/api/${item.key?.replace('?','/')}expand`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ expanded: `${!item.isExpanded}` })})
              .then(r => console.log(r))
        }
      }

      return (
          <div className='TagList' onContextMenu={onShowContextualMenu} ref={tagListRef}>
            <Shimmer isDataLoaded={!!props.tags}>
              <Nav
                  selectedKey={props.selectedId}
                  groups={tagList ?? []}
                  onLinkClick={onSelect}
                  onLinkExpandClick={onExpand}
              />
            </Shimmer>
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
