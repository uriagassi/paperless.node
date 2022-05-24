import React, {useState} from 'react';
import {
  BaseButton,
  Icon,
  initializeIcons,
  IStackStyles,
  IStackTokens,
  SearchBox,
  Stack
} from '@fluentui/react';
import './App.css';
import {ITagWithChildren, TagList} from "./TagList";
import {DetailCard} from "./DetailCard";
import {KeyState, NoteList} from "./NoteList";
import eventBus from "./EventBus";
import {CommandBar} from "./CommandBar";
import {MultiNoteScreen} from "./MultiNoteScreen";


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
  const [activeNote, setActiveNote] = useState<number | undefined>(undefined)
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set())
  const [notebooks, setNotebooks] = useState<ITagWithChildren[] | undefined>(undefined)
  const [tags, setTags] = useState<ITagWithChildren[] | undefined>(undefined)
  const [keyState, setKeyState] = useState<KeyState>({})

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
      <Stack tokens={stackTokens} styles={stackStyles} onKeyDown={(e) => { setKeyState({ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey})}}
             onKeyUp={(e) => { setKeyState({ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey})}}>
        <Stack horizontal verticalAlign='baseline'>
          <BaseButton className='Hamburger'>
            <Icon iconName= 'GlobalNavButton'/>
          </BaseButton>
          <h1 className='App-header'>Paperless</h1>
          <SearchBox tabIndex={0} className='SearchBox' placeholder='Search Paperless' onSearch={doSearch}/>
          <CommandBar/>
        </Stack>
        <Stack horizontal className='MainView'>
          <TagList  selectedId={selectedFolder}
                   onSelectedIdChanged={(key) => setSelectedFolder(key)}
                   tags={tags} notebooks={notebooks}/>
          <NoteList tabIndex={2} filterId={selectedFolder} searchTerm={searchTerm} selectedId={activeNote}
                    selectedNotes={selectedNotes}
                    onSelectedIdChanged={(key, selectedKeys) => {
            setActiveNote(key);
            setSelectedNotes(selectedKeys)
          }} keyState={keyState}/>
          {selectedNotes.size > 1 ?
              <MultiNoteScreen selectedNotes={selectedNotes} availableNotebooks={notebooks} filterId={selectedFolder}/>
              : <DetailCard noteId={activeNote} availableTags={tags} availableNotebooks={notebooks}/>}
        </Stack>
      </Stack>
  );
};
