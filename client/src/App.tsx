import React, { createRef, useEffect, useState } from "react";
import {
  ActionButton,
  css,
  DefaultButton,
  getRTL,
  IconButton,
  initializeIcons,
  IStackStyles,
  IStackTokens,
  ITextField,
  PartialTheme,
  SearchBox,
  Spinner,
  SpinnerSize,
  Stack,
  TextField,
  ThemeProvider,
} from "@fluentui/react";
import "./App.css";
import { TagList } from "./TagList";
import { DetailCard } from "./DetailCard";
import { KeyState, NoteList } from "./NoteList";
import eventBus from "./EventBus";
import { CommandBar } from "./CommandBar";
import { MultiNoteScreen } from "./MultiNoteScreen";
import { UpdateTagDialog } from "./UpdateTagDialog";
import "semantic-ui-css/semantic.css";
import { Folder, Notebook, ServerAPI, Tag } from "./ServerAPI";
import { themeDark, themeLight } from "./themes";

initializeIcons();

const stackTokens: IStackTokens = { childrenGap: 15 };
const stackStyles: Partial<IStackStyles> = {
  root: {
    width: "100%",
    margin: "0 auto",
    textAlign: "center",
    color: "#605e5c",
    display: "flex",
    maxHeight: "100vh",
  },
};

export const App: React.FunctionComponent = () => {
  const [selectedFolder, setSelectedFolder] = useState<Folder>();
  const [searchTerm, setSearchTerm] = useState<string>();
  const [activeNote, setActiveNote] = useState<number>();
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [notebooks, setNotebooks] = useState<Notebook[]>();
  const [tags, setTags] = useState<Tag[]>();
  const [keyState, setKeyState] = useState<KeyState>();
  const [tagToUpdate, setTagToUpdate] = useState<Tag>();
  const [loggedInUser, setLoggedInUser] = useState<{ imageInitials: string; text: string; secondaryText?: string }>();
  const fileUploadRef = createRef<HTMLInputElement>();
  const [theme, setTheme] = useState<{ uiTheme: PartialTheme; darkMode: boolean }>();
  const [loadingText, setLoadingText] = useState<string>();
  const storedTheme = localStorage.getItem("theme");
  const [sideViewCollapsed, setSideViewCollapsed] = useState<boolean>();
  const [listViewWidth, setListViewWidth] = useState({ width: +(localStorage.getItem("listViewWidth") ?? 350) });
  const [listViewOffsetStart, setListViewOffsetStart] = useState<{ startValue: number; startPosition: number }>();
  const [serverAPI, setServerAPI] = useState<ServerAPI>();
  const [limit, setLimit] = useState<number>(100);
  const [tagFilter, setTagFilter] = useState<string>();
  const tagFilterInput = React.useRef<ITextField | null>();

  const setDark = () => {
    // 2
    localStorage.setItem("theme", "dark");

    // 3
    if (!theme?.darkMode) {
      setTheme({ uiTheme: themeDark, darkMode: true });
    }
  };

  const setLight = () => {
    localStorage.setItem("theme", "light");
    if (theme?.darkMode) {
      setTheme({ uiTheme: themeLight, darkMode: false });
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
    init();
  }, []);

  useEffect(() => {
    if (serverAPI) {
      loadNotebooks();
      eventBus.on("note-collection-change", loadNotebooks);
      eventBus.on("wait-screen", waitScreen);
      return () => {
        eventBus.remove("note-collection-change", loadNotebooks);
        eventBus.remove("wait-screen", waitScreen);
      };
    }
  }, [serverAPI]);

  function loadNotebooks() {
    serverAPI?.loadNotebooks().then((data) => {
      setNotebooks(data.notebooks);
      setTags(data.tags);
    });
  }

  useEffect(() => {
    if (!theme) {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

      const defaultDark = storedTheme === "dark" || (storedTheme === null && prefersDark);

      if (defaultDark) {
        setDark();
      }
    } else {
      if (theme.darkMode) {
        setDark();
      } else {
        setLight();
      }
    }
  }, [theme]);

  function waitScreen(e: CustomEvent) {
    setLoadingText(e.detail);
  }

  async function init() {
    const s = new ServerAPI();
    await s.authSetup();
    const user = await s.user();
    setLoggedInUser({
      text: user.user_name,
      imageInitials: Array.from(user.user_name.matchAll(/\b\w/g)).join(" "),
    });
    setServerAPI(s);
  }

  function doSearch(newValue: string) {
    setLimit(100);
    setSearchTerm(newValue);
  }

  function doSetSelectedFolder(folder: Folder) {
    setLimit(100);
    setSelectedFolder(folder);
  }

  const onUpdateTagClose = (key: number | undefined) => {
    if (key && tagToUpdate?.key === -1) {
      setLimit(100);
      setSelectedFolder({ ...tagToUpdate, key });
    }
    setTagToUpdate(undefined);
  };

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    console.log(e.target.files);
    if (e.target.files) {
      console.log(e.target.files?.[0]);
      await serverAPI?.uploadNewNote(e.target.files[0]);
      eventBus.dispatch("note-collection-change", { notebooks: ["I"] });
    }
  }

  function clickUpload() {
    fileUploadRef.current?.click();
  }

  function updateListViewWidth(newPos: number) {
    if (listViewOffsetStart) {
      let change = newPos - listViewOffsetStart.startPosition;
      if (getRTL()) {
        change = -change;
      }
      setListViewWidth({ width: Math.min(480, Math.max(240, listViewOffsetStart.startValue + change)) });
    }
  }

  function stopListViewResize() {
    setListViewOffsetStart(undefined);
    localStorage.setItem("listViewWidth", `${listViewWidth.width}`);
  }

  function onFilterChanged(
    _event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string | undefined
  ) {
    setTagFilter(newValue);
  }

  return (
    <ThemeProvider
      applyTo="body"
      theme={theme?.uiTheme}
      data-theme={theme?.darkMode ? "dark" : "light"}
      className="MainWindow"
      onMouseUp={() => stopListViewResize()}
      onMouseMove={(e) => updateListViewWidth(e.pageX)}
      style={listViewOffsetStart ? { cursor: "col-resize" } : {}}
    >
      <Stack
        tokens={stackTokens}
        styles={stackStyles}
        onKeyDown={(e) => setKeyState({ ...e, update: Date.now() })}
        onKeyUp={(e) => setKeyState({ ...e, update: Date.now() })}
        onClick={(e) => setKeyState({ ...e, update: Date.now() })}
        className="MainWindow"
      >
        <Stack horizontal verticalAlign="baseline">
          <IconButton
            className="Command"
            iconProps={{ iconName: "GlobalNavButton" }}
            onClick={() => setSideViewCollapsed(!sideViewCollapsed)}
          />
          <h1 className="App-header">Paperless</h1>
          <SearchBox
            tabIndex={0}
            className="SearchBox"
            placeholder="Search Paperless"
            onSearch={doSearch}
            onClear={() => doSearch("")}
          />
          <CommandBar
            loggedIn={loggedInUser ?? { imageInitials: "?", text: "Unknown" }}
            isDark={theme?.darkMode ?? false}
            onDarkChanged={() => toggleDarkMode()}
            onLoadingText={setLoadingText}
            api={serverAPI}
          />
        </Stack>
        <Stack horizontal className="MainView">
          <Stack className={css("SideView", sideViewCollapsed ? "collapsed" : undefined)}>
            <DefaultButton
              className="NewNoteButton"
              name="New Note"
              text="New Note"
              iconProps={{ iconName: "BulkUpload" }}
              onClick={clickUpload}
            />
            <input ref={fileUploadRef} style={{ display: "none" }} type="file" onChange={uploadFile} />
            <TagList
              selectedId={selectedFolder}
              onSelectedIdChanged={(key) => {
                if (selectedFolder != key) {
                  setActiveNote(undefined);
                  setLimit(100);
                  setSelectedFolder(key);
                }
              }}
              tags={tags}
              notebooks={notebooks}
              updateTag={setTagToUpdate}
              api={serverAPI}
              tagFilter={tagFilter}
              setTagFilter={setTagFilter}
              focusOnTagFilter={() => tagFilterInput.current?.focus()}
            />
            <Stack horizontal className="TagActions">
              <ActionButton
                text="Add Tag"
                iconProps={{ iconName: "Tag" }}
                className="NewTagButton"
                name="Add Tag"
                onClick={() => setTagToUpdate({ kind: "tag", key: -1, name: "", notes: 0, parent: 0 })}
              />
              <TextField
                onChange={onFilterChanged}
                className="FilterTag"
                placeholder="Find tag..."
                value={tagFilter}
                componentRef={(input) => (tagFilterInput.current = input)}
              />
            </Stack>
          </Stack>
          <NoteList
            style={listViewWidth}
            tabIndex={2}
            selectedFolder={selectedFolder}
            searchTerm={searchTerm}
            selectedId={activeNote}
            api={serverAPI}
            selectedNotes={selectedNotes}
            limit={limit}
            onSelectedIdChanged={(key, selectedKeys) => {
              setActiveNote(key);
              setSelectedNotes(selectedKeys);
            }}
            onIncreaseLimit={(amount?: number) => {
              setLimit(limit + (amount ?? 10));
            }}
            keyState={keyState}
          />
          <div
            className="ResizeHandle"
            onMouseDown={(e) => setListViewOffsetStart({ startValue: listViewWidth.width, startPosition: e.pageX })}
          />
          {!activeNote ? (
            <div className="EmptyDetails">
              <div>There are no notes in this {selectedFolder?.kind}.</div>
            </div>
          ) : selectedNotes.size > 1 ? (
            <MultiNoteScreen
              selectedNotes={selectedNotes}
              availableNotebooks={notebooks}
              filterId={`${selectedFolder?.kind}s/${selectedFolder?.key}`}
              activeNote={activeNote}
              api={serverAPI}
            />
          ) : (
            <DetailCard
              noteId={activeNote}
              availableTags={tags}
              availableNotebooks={notebooks}
              updateTag={setTagToUpdate}
              api={serverAPI}
              focusTag={doSetSelectedFolder}
            />
          )}
        </Stack>
      </Stack>
      <UpdateTagDialog tag={tagToUpdate} availableTags={tags} onClose={onUpdateTagClose} api={serverAPI} />
      <div className="LoadingModalView" hidden={!loadingText}>
        <Spinner size={SpinnerSize.large} label={loadingText} />
      </div>
    </ThemeProvider>
  );
};
