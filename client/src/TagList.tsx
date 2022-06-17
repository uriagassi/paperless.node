import React, {createRef, useEffect, useState} from "react";
import {
  ContextualMenu,
  INavLink,
  INavLinkGroup,
  ITag,
  Nav,
  Shimmer
} from "@fluentui/react";
import {TagContextMenu} from "./TagContextMenu";
import {AddNotebookDialog} from "./AddNotebookDialog";
import {useBoolean} from "@fluentui/react-hooks";
import eventBus from "./EventBus";

export const TagList: React.FunctionComponent<{
  selectedId: string | undefined,
  onSelectedIdChanged: (key?: string) => void,
  tags: ITagWithChildren[] | undefined,
  notebooks: ITagWithChildren[] | undefined, updateTag: (tag : ITagWithChildren) => any }> =
    (props) => {

      const [tagList, setTagList] = useState<INavLinkGroup[]>([])
      const [showArchiveContext, setShowArchiveContext] = useState<Element>()
      const [showTrashContext, setShowTrashContext] = useState<Element>()
      const [addNotebook, { toggle: toggleAddNotebook }] = useBoolean(false)
      const tagListRef = createRef<HTMLDivElement>()

      function addNote(notebooks: INavLink[], n: ITagWithChildren, icon: string) {
        notebooks.push({
          key: 'notebooks/' + n.key + '?',
          name: n.name + (n.notes ? " (" + n.notes + ")" : ""),
          icon: icon,
          isExpanded: n.isExpanded
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
        const isArchiveExpanded = tagList?.[0]?.links?.find(l => l.icon == 'Archive')?.isExpanded??true
        props.notebooks?.filter(n => n.type == 'A').forEach(n => addNote(notebooks, {...n, isExpanded: isArchiveExpanded},  "Archive"))
        if (notebooks.length > 0) {
          const customNotebookLinks: INavLink[] = []
          props.notebooks?.filter(n => !n.type).forEach(n => addNote(customNotebookLinks, n, "BookAnswers"))
          notebooks[notebooks.length - 1].links = customNotebookLinks
        }
        props.notebooks?.filter(n => n.type == 'D').forEach(n => addNote(notebooks, n, "Delete"))
        let selectedId = props.selectedId || notebooks[0]?.key
        if (selectedId != props.selectedId) {
          props.onSelectedIdChanged(selectedId);
        }
        setTagList([
          {
            name: "Notebooks",
            links: notebooks,
          }, {
            name: 'Tags',
            links: links,
          }]);
      }, [props.tags, props.notebooks])

      const onSelect = (ev?: React.MouseEvent<HTMLElement>, item?: INavLink) => {
        props.onSelectedIdChanged(item?.key)
      }

      useEffect(() => {
        if (props.selectedId && tagList.length > 1) {
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
        if (tagItem) {
          const iconName = tagItem.querySelector('.ms-Icon')?.attributes?.getNamedItem('data-icon-name')?.textContent;
          switch (iconName) {
            case 'Tag':
              const textContent = tagItem.querySelector('.ms-Nav-linkText')?.textContent?.match(/(.*?)( \(\d+\))?$/)
              console.log(textContent)
              if (textContent) {
                const found = props.tags?.find(t => t.name == textContent[1]);
                if (found) {
                  ev.preventDefault();
                  setDoUpdate({target: tagItem, tag: found as ITagWithChildren})
                }
              }
              break
            case 'Archive':
              ev.preventDefault()
              setShowArchiveContext(tagItem)
              break
            case 'Delete':
              ev.preventDefault()
              setShowTrashContext(tagItem)
              break
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

      function emptyTrash() {
        eventBus.dispatch('wait-screen', 'Emptying Trash...')
        fetch('api/trash', {method: 'DELETE'}).then(() => {
          eventBus.dispatch('note-collection-change', {notebooks: [props.notebooks?.find(n => n.type == 'D')?.key]})
          eventBus.dispatch('wait-screen', undefined)
        })
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
            <ContextualMenu
                items={[{key: 'add-notebook', text: 'Add Notebook...', onClick: toggleAddNotebook, iconProps: { iconName: 'BookAnswers'}}]}
                hidden={!showArchiveContext}
                target={showArchiveContext}
                onDismiss={() => setShowArchiveContext(undefined)}
            />
            <ContextualMenu
                items={[{key: 'empty-trash', text: 'Empty...', onClick: emptyTrash, iconProps: { iconName: 'Trash'}}]}
                hidden={!showTrashContext}
                target={showTrashContext}
                onDismiss={() => setShowTrashContext(undefined)}
            />
            <AddNotebookDialog show={addNotebook} availableNotebooks={props.notebooks} onClose={toggleAddNotebook}/>
          </div>
      );
    }

export interface ITagWithChildren extends ITag {
  notes: number;
  parent?: number;
  isExpanded?: boolean;
  type?: string;
}
