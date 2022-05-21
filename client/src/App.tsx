import React, {useState} from 'react';
import {
  BaseButton,
  CommandBar,
  ICommandBarItemProps,
  initializeIcons,
  IStackStyles,
  IStackTokens,
  SearchBox,
  Stack
} from '@fluentui/react';
import './App.css';
import {ITagWithChildren, TagList} from "./TagList";
import {DetailCard} from "./DetailCard";
import {NoteList} from "./NoteList";


// Initialize icons in case this example uses them
initializeIcons();

const stackTokens: IStackTokens = { childrenGap: 15 };
const stackStyles: Partial<IStackStyles> = {
  root: {
    width: '100%',
    margin: '0 auto',
    textAlign: 'center',
    color: '#605e5c',
    display: "flex",
    maxHeight: '100vh'
  },
};

const _menuItems: ICommandBarItemProps[] = [
  {
    key: 'file',
    text: 'File',
    subMenuProps: {
      items: [
        {key: 'open', text: 'Open'},
        {key: 'save', text: 'Save'},
        {key: 'quit', text: 'Quit'}
      ]
    },
  },
  { key: 'note',
  text: 'Note',
  subMenuProps: {items: []}
  },
  {
    key: 'help',
    text: 'Help',
    subMenuProps: {
      items: [{key: 'about', text: 'About...'}]
    }
  }

]

export const App: React.FunctionComponent = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [selectedNote, setSelectedNote] = useState<number | undefined>(undefined)
  const [notebooks, setNotebooks] = useState<ITagWithChildren[] | undefined>(undefined)
  const [tags, setTags] = useState<ITagWithChildren[] | undefined>(undefined)
  React.useEffect(() => {
    fetch("/api/notebooks_and_tags")
        .then((res) => res.json())
        .then((data : { tags: ITagWithChildren[], notebooks: any[]}) => {
          setNotebooks(data.notebooks);
          setTags(data.tags);
        });
  }, [])
  return (
      <Stack tokens={stackTokens} styles={stackStyles}>
        <Stack horizontal verticalAlign='baseline'>
          <BaseButton className='Hamburger'>
            <svg viewBox="0 0 18 18" width="100%"
                 preserveAspectRatio="xMidYMid meet" focusable="false">
              <path d="M2 13.5h14V12H2v1.5zm0-4h14V8H2v1.5zM2 4v1.5h14V4H2z"/>
            </svg>
          </BaseButton>
          <h1 className='App-header'>Paperless</h1>
          <SearchBox className='SearchBox' placeholder='Search Paperless'/>
          <CommandBar className='CommandBar' items={_menuItems}/>
        </Stack>
        <Stack horizontal className='MainView'>
          <TagList selectedId={selectedFolder}
                   onSelectedIdChanged={(key) => setSelectedFolder(key)}
                   tags={tags} notebooks={notebooks}/>
          <NoteList filterId={selectedFolder} selectedId={selectedNote} onSelectedIdChanged={(key) => setSelectedNote(key)}/>
          <DetailCard noteId={selectedNote} availableTags={tags} availableNotebooks={notebooks}/>
        </Stack>
      </Stack>
  );
};
