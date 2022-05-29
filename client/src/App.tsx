import React, {useEffect, useState} from 'react';
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
import {UpdateTagDialog} from "./UpdateTagDialog";
import 'semantic-ui-css/semantic.css'
import {ISSO} from "./sso/ISSO";
import {ServerAPI} from "./ServerAPI";

const SSO = import('./sso/' + (process.env.REACT_APP_SSO_HANDLER ?? 'EmptySSO') + '.tsx');
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

const serverAPI = new ServerAPI()
export const App: React.FunctionComponent = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const [activeNote, setActiveNote] = useState<number | undefined>(undefined)
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set())
  const [notebooks, setNotebooks] = useState<ITagWithChildren[] | undefined>(undefined)
  const [tags, setTags] = useState<ITagWithChildren[] | undefined>(undefined)
  const [keyState, setKeyState] = useState<KeyState>({})
  const [tagToUpdate, setTagToUpdate] = useState<ITagWithChildren | undefined>()
  const [loggedInUser, setLoggedInUser] = useState<{imageInitials: string, text: string, secondaryText?: string}>()
  const [auth, setAuth] = useState<ISSO>()

  useEffect(() => {
    SSO.then(m => setAuth(new m.SSO()))
      }
  ,[])

  function loadNotebooks() {
    serverAPI.loadNotebooks().then((data: { tags: ITagWithChildren[], notebooks: any[] }) => {
          setNotebooks(data.notebooks);
          setTags(data.tags);
        });
  }

  useEffect(() => {
    if (auth) {
      serverAPI.setHeader({key: 'x-access-token', value: auth.login()})
      serverAPI.user().then(u => {
        setLoggedInUser({
          text: u.user_name,
          imageInitials: Array.from(u.user_name.matchAll(/\b\w/g)).join(' ')
        })
      })
      loadNotebooks();
      eventBus.on('note-collection-change', loadNotebooks)
    }
  }, [auth])

  function doSearch(newValue: string) {
    setSearchTerm(newValue)
  }

  const updateTag = (tag: ITagWithChildren) => {
    setTagToUpdate(tag)
  }

  const onUpdateTagClose = () => {
    setTagToUpdate(undefined)
  }


  return (
      <>
      <Stack tokens={stackTokens} styles={stackStyles} onKeyDown={setKeyState}
             onKeyUp={setKeyState} onClick={setKeyState}>
        <Stack horizontal verticalAlign='baseline'>
          <BaseButton className='Hamburger'>
            <Icon iconName= 'GlobalNavButton'/>
          </BaseButton>
          <h1 className='App-header'>Paperless</h1>
          <SearchBox tabIndex={0} className='SearchBox' placeholder='Search Paperless' onSearch={doSearch} onClear={() => doSearch('')}/>
          <CommandBar loggedIn={loggedInUser ?? {imageInitials: '?', text:'Unknown'}} sso={auth}/>
        </Stack>
        <Stack horizontal className='MainView'>
          <TagList  selectedId={selectedFolder}
                   onSelectedIdChanged={(key) => setSelectedFolder(key)}
                   tags={tags} notebooks={notebooks} updateTag={updateTag}/>
          <NoteList tabIndex={2} filterId={selectedFolder} searchTerm={searchTerm} selectedId={activeNote}
                    api={serverAPI}
                    selectedNotes={selectedNotes}
                    onSelectedIdChanged={(key, selectedKeys) => {
            setActiveNote(key);
            setSelectedNotes(selectedKeys)
          }} keyState={keyState}/>
          {selectedNotes.size > 1 ?
              <MultiNoteScreen selectedNotes={selectedNotes} availableNotebooks={notebooks} filterId={selectedFolder}/>
              : <DetailCard noteId={activeNote} availableTags={tags} availableNotebooks={notebooks} updateTag={updateTag} api={serverAPI}
              sso={auth}/>}
        </Stack>
      </Stack>
        <UpdateTagDialog tag={tagToUpdate} availableTags={tags} onClose={onUpdateTagClose}/>
        </>
  );
};
