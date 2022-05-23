import React, {useState} from 'react';
import {
  BaseButton,
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
import eventBus from "./EventBus";
import {CommandBar} from "./CommandBar";


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
export const App: React.FunctionComponent = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const [selectedNote, setSelectedNote] = useState<number | undefined>(undefined)
  const [notebooks, setNotebooks] = useState<ITagWithChildren[] | undefined>(undefined)
  const [tags, setTags] = useState<ITagWithChildren[] | undefined>(undefined)

  function loadNotebooks() {
    fetch("/api/notebooks_and_tags")
        .then((res) => res.json())
        .then((data: { tags: ITagWithChildren[], notebooks: any[] }) => {
          setNotebooks(data.notebooks);
          setTags(data.tags);
        });
  }

  React.useEffect(() => {
    loadNotebooks();
    eventBus.on('note-collection-change', loadNotebooks)
  }, [])

  function doSearch(newValue: string) {
    setSearchTerm(newValue)
  }


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
          <SearchBox tabIndex={0} className='SearchBox' placeholder='Search Paperless' onSearch={doSearch}/>
          <CommandBar/>
        </Stack>
        <Stack horizontal className='MainView'>
          <TagList  selectedId={selectedFolder}
                   onSelectedIdChanged={(key) => setSelectedFolder(key)}
                   tags={tags} notebooks={notebooks}/>
          <NoteList tabIndex={2} filterId={selectedFolder} searchTerm={searchTerm} selectedId={selectedNote} onSelectedIdChanged={(key) => setSelectedNote(key)}/>
          <DetailCard  noteId={selectedNote} availableTags={tags} availableNotebooks={notebooks}/>
        </Stack>
      </Stack>
  );
};
