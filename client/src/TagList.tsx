import React from "react";
import {INavLink, INavLinkGroup, ITag, Nav} from "@fluentui/react";

export class TagList extends React.Component<{selectedId: string | undefined, onSelectedIdChanged: (key?: string) => void, tags: ITagWithChildren[] | undefined, notebooks: ITagWithChildren[] | undefined}, {tagList: INavLinkGroup[]}> {
  constructor(props: any) {
    super(props);
    
    this.onSelect = this.onSelect.bind(this)
  }

 componentDidUpdate(prevProps: Readonly<{ selectedId: string | undefined; onSelectedIdChanged: (key?: string) => void; tags: ITagWithChildren[] | undefined; notebooks: ITagWithChildren[] | undefined }>, prevState: Readonly<{ tagList: INavLinkGroup[] }>, snapshot?: any) {
    if (this.props.tags != prevProps.tags || this.props.notebooks != prevProps.notebooks) {
      let links: INavLink[] = [];
      let tags: { [key: string]: INavLink } = {};
      let notebooks: INavLink[] = []
      this.props.tags?.forEach((tag: ITagWithChildren) => {
        tags[tag.key] = {
          key: 'tags/' + tag.key,
          name: tag.name + (tag.notes ? " (" + tag.notes + ")" : ""),
          icon: 'Tag',
          isExpanded: tag.isExpanded,
          url: '#',
          links: []
        }
      });
      this.props.tags?.forEach(item => {
        let current = tags[item.key]
        if (item.parent == 0) {
          links.push(current);
        } else {
          tags['' + (item.parent ?? '')]?.links?.push(current)
        }
      });
      this.props.notebooks?.forEach((n: ITagWithChildren) => {
        notebooks.push({
          key: 'notebooks/' + n.key,
          name: n.name + (n.notes ? " (" + n.notes + ")" : ""),
          icon: "Inbox"
        } as INavLink)
      })
      let selectedId = this.props.selectedId || notebooks[0]?.key
      if (selectedId != this.props.selectedId) {
        this.props.onSelectedIdChanged(selectedId);
      }
      this.setState({
        tagList: [
          {
            name: "Notebooks",
            links: notebooks
          }, {
            name: 'Tags',
            links: links,
          }]
      });
    }
 }

  onSelect(ev?: React.MouseEvent<HTMLElement>, item?: INavLink) {
    this.props.onSelectedIdChanged(item?.key)
  }

  render() {
    return (
        <div className='TagList'>
          <Nav
              selectedKey={this.props.selectedId}
              groups={this.state?.tagList ?? []}
              onLinkClick={this.onSelect}
          />
        </div>
    );
  }
}

export interface ITagWithChildren extends ITag {
  notes : number;
  parent?: number;
  isExpanded?: boolean;
}
