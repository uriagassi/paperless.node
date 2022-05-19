import React from "react";
import {INavLink, INavLinkGroup, Nav} from "@fluentui/react";

export class TagList extends React.Component<{}, {tagList: INavLinkGroup[]}> {
  constructor(props: any) {
    super(props);
    this.state = {
      tagList: [{
        name: "Notebooks",
        links: [{
          name: 'Archive (3582)', key: 'archive', url: '',
          icon: 'Inbox'
        }, {
          name: 'To Sort (30)', key: 'to-sort', url: '#',
          icon: "Inbox"
        }],
      }]
    };
  }
  componentDidMount() {
    fetch("/api/tags")
        .then((res) => res.json())
        .then((data) => {
          let links: INavLink[] = [];
          let tags: INavLink[] = [];
          for (let i = 0; i < data.tags.length; i++) {
            let tag = data.tags[i];
            tags[tag.id] = {
              key: tag.id,
              name: tag.name + (tag.notes ? " (" + tag.notes + ")" : ""),
              icon: 'Tag',
              isExpanded: true,
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

          this.setState({tagList: [this.state.tagList[0], {
              name: 'Tags',
              links: links,
            }]});
        });
  }

  render() {
    return (
        <div className='TagList'>
          <Nav
              groups={this.state.tagList}
          />
        </div>
    );
  }
}
