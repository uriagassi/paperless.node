import React, {createRef, useEffect, useState} from 'react';
import {
  BaseButton, css,
  DefaultButton, getRTL,
  Icon, IconButton,
  initializeIcons,
  IStackStyles,
  IStackTokens, PartialTheme,
  SearchBox,
  Spinner,
  SpinnerSize,
  Stack,
  ThemeProvider
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
import {themeDark, themeLight} from "./themes";

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
  const [keyState, setKeyState] = useState<KeyState>()
  const [tagToUpdate, setTagToUpdate] = useState<ITagWithChildren | undefined>()
  const [loggedInUser, setLoggedInUser] = useState<{imageInitials: string, text: string, secondaryText?: string}>()
  const [auth, setAuth] = useState<ISSO>()
  const fileUploadRef = createRef<HTMLInputElement>()
  const [theme, setTheme] = useState<{uiTheme: PartialTheme, darkMode: boolean}>()
  const [loadingText, setLoadingText] = useState<string>()
  const storedTheme = localStorage.getItem("theme");
  const [sideViewCollapsed, setSideViewCollapsed] = useState<boolean>()
  const [listViewWidth, setListViewWidth] = useState({ width: Number(localStorage.getItem('listViewWidth') ?? 350) })
  const [listViewOffsetStart, setListViewOffsetStart] = useState<{ startValue: number, startPosition: number}>()

  const setDark = () => {

    // 2
    localStorage.setItem("theme", "dark");

    // 3
    if (!theme?.darkMode) {
      setTheme({uiTheme: themeDark, darkMode: true});
    }
  };

  const setLight = () => {
    localStorage.setItem("theme", "light");
    if (theme?.darkMode) {
      setTheme({uiTheme: themeLight, darkMode: false});
    }
  };

  function toggleDarkMode() {
    if (theme?.darkMode) {
      setLight();
    } else {
      setDark();
    }
  }

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
    if (!theme) {
      const prefersDark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;

      const defaultDark =
          storedTheme === "dark" || (storedTheme === null && prefersDark);

      if (defaultDark) {
        setDark();
      }
    } else {
      if (theme.darkMode) {
        setDark()
      } else {
        setLight()
      }
    }
  }, [theme])

  function waitScreen(e: CustomEvent) {
    setLoadingText(e.detail)
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
      eventBus.on('wait-screen', waitScreen)
    }
    return () => {
      eventBus.remove('note-collection-change', loadNotebooks)
      eventBus.remove('wait-screen', waitScreen)
    }
  }, [auth])

  function doSearch(newValue: string) {
    setSearchTerm(newValue)
  }

  const onUpdateTagClose = () => {
    setTagToUpdate(undefined)
  }

  function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    console.log(e.target.files)
    if (e.target.files) {
      console.log(e.target.files?.[0])
      const formData = new FormData();
      formData.append('newNote', e.target.files[0], e.target.files[0].name)
      fetch('/api/files/new', { method: 'POST', body: formData}).then(() => {
        eventBus.dispatch('note-collection-change', { notebooks: [2]})
      })
    }
  }

  function clickUpload() {
    fileUploadRef.current?.click();
  }

  function updateListViewWidth(newPos: number) {
    if (listViewOffsetStart) {
      let change = newPos - listViewOffsetStart.startPosition;
      if (getRTL()) {
        change = -change
      }
      setListViewWidth({width: Math.min(480, Math.max(240, listViewOffsetStart.startValue + change))})
    }
  }

  function stopListViewResize() {
    setListViewOffsetStart(undefined)
    localStorage.setItem('listViewWidth', `${listViewWidth.width}`)
  }

  return (
      <ThemeProvider applyTo="body" theme={theme?.uiTheme} data-theme={theme?.darkMode ? 'dark' : 'light'} className='MainWindow' onMouseUp={() => stopListViewResize()} onMouseMove={e => updateListViewWidth(e.pageX)} style={listViewOffsetStart ? { cursor: 'col-resize'} : {}}>
      <Stack tokens={stackTokens} styles={stackStyles} onKeyDown={e => setKeyState({...e, update: Date.now()})}
             onKeyUp={e => setKeyState({...e, update: Date.now()})} onClick={e => setKeyState({...e, update: Date.now()})} className='MainWindow'>
        <Stack horizontal verticalAlign='baseline'>
          <IconButton className='Command' iconProps={{iconName:'GlobalNavButton'}} onClick={() => setSideViewCollapsed(!sideViewCollapsed)}/>
          <h1 className='App-header'>Paperless</h1>
          <SearchBox tabIndex={0} className='SearchBox' placeholder='Search Paperless' onSearch={doSearch} onClear={() => doSearch('')}/>
          <CommandBar loggedIn={loggedInUser ?? {imageInitials: '?', text:'Unknown'}} sso={auth} isDark={theme?.darkMode ?? false} onDarkChanged={() => toggleDarkMode()}
          onLoadingText={setLoadingText}/>
        </Stack>
        <Stack horizontal className='MainView'>
          <Stack className={css('SideView', sideViewCollapsed ? 'collapsed' : undefined)}>
            <DefaultButton className='NewNoteButton' name='New Note' text='New Note' iconProps={{iconName: 'BulkUpload'}} onClick={clickUpload}/>
            <input ref={fileUploadRef} style={{ display: "none" }} type="file" onChange={uploadFile} />
          <TagList  selectedId={selectedFolder}
                   onSelectedIdChanged={(key) => {
                     setActiveNote(undefined)
                     setSelectedFolder(key)
                   }}
                   tags={tags} notebooks={notebooks} updateTag={setTagToUpdate}/>
          </Stack>
          <NoteList style={listViewWidth} tabIndex={2} filterId={selectedFolder} searchTerm={searchTerm} selectedId={activeNote}
                    api={serverAPI}
                    selectedNotes={selectedNotes}
                    onSelectedIdChanged={(key, selectedKeys) => {
            setActiveNote(key);
            setSelectedNotes(selectedKeys)
          }} keyState={keyState}/>
          <div className='ResizeHandle' onMouseDown={e => setListViewOffsetStart({startValue: listViewWidth.width, startPosition: e.pageX})}/>
          {selectedNotes.size > 1 ?
              <MultiNoteScreen selectedNotes={selectedNotes} availableNotebooks={notebooks} filterId={selectedFolder} activeNote={activeNote}/>
              : <DetailCard noteId={activeNote} availableTags={tags} availableNotebooks={notebooks} updateTag={setTagToUpdate} api={serverAPI} focusTag={t => setSelectedFolder(`tags/${t.key}?`)}
              sso={auth}/>}
        </Stack>
      </Stack>
        <UpdateTagDialog tag={tagToUpdate} availableTags={tags} onClose={onUpdateTagClose}/>
        <div className='LoadingModalView' hidden={!loadingText}>
          <Spinner size={SpinnerSize.large} label={loadingText}/>
        </div>
        </ThemeProvider>
  );
};
