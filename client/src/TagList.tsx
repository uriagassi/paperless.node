import React from "react";
import {INavLink, INavLinkGroup, Nav} from "@fluentui/react";

export class TagList extends React.Component<{selectedId: string | undefined, onSelectedIdChanged: (key?: string) => void}, {tagList: INavLinkGroup[]}> {
  constructor(props: any) {
    super(props);
    this.state = {
      tagList: []
    };
    this.onSelect = this.onSelect.bind(this)
  }
  componentDidMount() {
    fetch("/api/notebooks_and_tags")
        .then((res) => res.json())
        .then((data) => {
          let links: INavLink[] = [];
          let tags: INavLink[] = [];
          let notebooks: INavLink[] = []
          for (let i = 0; i < data.tags.length; i++) {
            let tag = data.tags[i];
            tags[tag.id] = {
              key: 'tags/' + tag.id,
              name: tag.name + (tag.notes ? " (" + tag.notes + ")" : ""),
              icon: 'Tag',
              isExpanded: tag.isExpanded,
              url: '#',
              links: []
            }
          }
          for (let i = 0; i < data.tags.length; i++) {
            let current = tags[data.tags[i].id]
            if (data.tags[i].parent == 0) {
              links.push(current);
            } else {
              tags[data.tags[i].parent]?.links?.push(current)
            }
          }
          data.notebooks.forEach((n: { id: any; name: string; notes: number; }) =>
            notebooks.push({
            key: 'notebooks/' + n.id,
              name: n.name + (n.notes ? " (" + n.notes + ")" : ""),
              icon: "Inbox"
          } as INavLink))
          let selectedId  = this.props.selectedId || notebooks[0].key
          if (selectedId != this.props.selectedId) {
            this.props.onSelectedIdChanged( selectedId);
          }
          this.setState({tagList: [
              {name: "Notebooks",
              links: notebooks}, {
              name: 'Tags',
              links: links,
            }]});
        });
  }
  onSelect(ev?: React.MouseEvent<HTMLElement>, item?: INavLink) {
    this.props.onSelectedIdChanged(item?.key)
  }

  render() {
    return (
        <div className='TagList'>
          <Nav
              selectedKey={this.props.selectedId}
              groups={this.state.tagList}
              onLinkClick={this.onSelect}
          />
        </div>
    );
  }
}
