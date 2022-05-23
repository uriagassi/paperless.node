import React, {useEffect, useState} from "react";
import {INavLink, INavLinkGroup, ITag, Nav} from "@fluentui/react";

export const TagList: React.FunctionComponent<{
  selectedId: string | undefined,
  onSelectedIdChanged: (key?: string) => void,
  tags: ITagWithChildren[] | undefined,
  notebooks: ITagWithChildren[] | undefined }> =
    (props: { selectedId: string | undefined, onSelectedIdChanged: (key?: string) => void, tags: ITagWithChildren[] | undefined, notebooks: ITagWithChildren[] | undefined }) => {

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
        icon: "Inbox"
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

  return (
      <div className='TagList'>
        <Nav
            selectedKey={props.selectedId}
            groups={tagList ?? []}
            onLinkClick={onSelect}
        />
      </div>
  );
}

export interface ITagWithChildren extends ITag {
  notes: number;
  parent?: number;
  isExpanded?: boolean;
}
