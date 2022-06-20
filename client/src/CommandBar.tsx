import React, {useEffect, useState} from "react";
import {
  ContextualMenu, getRTL,
  Icon,
  IconButton,
  Persona,
  PersonaSize, registerIcons, setRTL,
  Stack
} from "@fluentui/react";
import eventBus from "./EventBus";
import {ISSO} from "./sso/ISSO";

const MINUTE_MS = 600000;

registerIcons({
  icons: {
    'dark-mode-symbol-svg' : (
        <svg height="24px" viewBox="0 0 24 24" width="24px" preserveAspectRatio="xMidYMid meet" focusable="false"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-.89 0-1.74-.2-2.5-.55C11.56 16.5 13 14.42 13 12s-1.44-4.5-3.5-5.45C10.26 6.2 11.11 6 12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6z"/></svg>
    ),
    'light-mode-symbol-svg' : (
        <svg height="24px" viewBox="0 0 24 24" width="24px" preserveAspectRatio="xMidYMid meet" focusable="false"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>
    ),
    'scanner': (
        <svg height="24px" viewBox="2 2 30 30" width="24px" preserveAspectRatio="xMidYMid meet" focusable="false">
          <path d="M 19.94 30.166 L 17.552 30.166 L 17.556 28.819 L 19.944 28.819 L 19.94 30.166 Z M 21.135 30.166 L 23.523 30.166 L 23.527 28.819 L 21.139 28.819 L 21.135 30.166 Z M 12.775 30.166 L 10.386 30.166 L 10.39 28.819 L 12.779 28.819 L 12.775 30.166 Z M 13.969 30.166 L 16.358 30.166 L 16.362 28.819 L 13.973 28.819 L 13.969 30.166 Z M 9.192 30.166 L 7.995 30.181 C 6.674 30.181 5.594 29.103 5.594 27.999 L 5.594 27.009 L 7.015 27.017 L 7.023 27.918 C 7.029 28.462 7.467 28.806 7.979 28.827 L 9.196 28.819 L 9.192 30.166 Z M 28.285 23.02 L 28.285 21.026 L 26.978 21.064 L 26.978 23.058 L 28.285 23.02 Z M 28.285 24.017 L 28.285 26.011 L 26.978 26.049 L 26.978 24.055 L 28.285 24.017 Z M 5.594 23.02 L 5.594 21.026 L 7.015 21.034 L 7.015 23.028 L 5.594 23.02 Z M 5.594 24.017 L 5.594 26.011 L 6.992 25.996 L 7.015 24.025 L 5.594 24.017 Z M 29.494 18.84 L 29.479 17.037 L 30.816 17.037 L 30.816 22.022 L 29.479 22.022 L 29.52 20.287 L 4.441 20.287 L 4.4 22.022 L 3.064 22.022 L 3.064 17.037 L 4.4 17.037 L 4.415 18.84 L 29.494 18.84 Z M 28.285 18.033 L 28.285 11.053 L 22.321 11.053 C 20.998 11.053 19.925 10.169 19.925 9.061 L 19.925 3.076 L 7.993 3.076 C 6.669 3.076 5.594 3.971 5.594 5.077 L 5.594 18.033 L 28.285 18.033 Z M 28.285 27.009 L 28.285 28.009 C 28.285 29.111 27.232 30.166 25.914 30.166 L 24.75 30.166 L 24.721 28.819 L 25.992 28.827 C 26.549 28.725 26.865 28.61 26.921 28.116 L 26.978 27.047 L 28.285 27.009 Z M 21.12 3.076 L 21.12 9.056 C 21.12 9.608 21.658 10.056 22.302 10.056 L 28.285 10.056 L 21.12 3.076 Z" />
        </svg>
    )

  }
})

export const CommandBar: React.FunctionComponent<{loggedIn: {imageInitials: string, text: string}, isDark: boolean, onDarkChanged: () => any, sso: ISSO | undefined, onLoadingText: (text: string | undefined) => any}> = props => {
  const [pendingImport, setPendingImport] = useState<number>(0)
  const [gmailAuthenticateURL, setGmailAuthenticateURL] = useState<string>()
  const [gmailAddress, setGmailAddress] = useState<string>()
  const [pendingMail, setPendingMail] = useState<number|string>('?')
  const [gmailUnsupported, setGmailUnsupported] = useState(false)
  const [personaCMElement, setPersonaCMElement] = useState<Element>()
  const [gmailCMElement, setGmailCMElement] = useState<Element>()

  useEffect(() => {
    if (window.location.pathname == '/gmail') {
      const queryParams = new URLSearchParams(window.location.search)
      fetch('/api/mail/auth?access_token=' + (queryParams.get('code') ?? '')).then((res) => {
            if (res.status == 200) {
              window.location.pathname = '/';
            } else {
              console.log(res.body)
            }
          }
      )
    }
    refreshPendingCount(true)
    const interval = setInterval(() => {
      refreshPendingCount(false)
    }, MINUTE_MS)
    return () => clearInterval(interval);
  }, [])

  function importFiles() {
    fetch('/api/files/import').then(() => {
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
      refreshPendingCount(false)
    })
  }

  function importMail() {
    props.onLoadingText("Importing from Gmail...")
    fetch('/api/mail/import', {method: 'POST', headers: {'Content-Type': 'application/json'}}).then(r => r.json()).then(r => {
      if (r.authenticate) {
        window.location.href = r.authenticate
      }
      if (r.pendingThreads) {
        setPendingMail(r.pendingThreads)
      }
      console.log(r)
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
      props.onLoadingText(undefined)
    })
  }

  function refreshPendingCount(force: boolean) {
    fetch('/api/files/checkStatus')
        .then(result => {
          if (result.status == 403) {
            window.location.hash = '#'
          }
          return result.json()
        })
        .then(r => setPendingImport(r.pending))
    if (force || pendingMail != '?') {
      console.log(`pendingMail = ${pendingMail}, ${pendingMail == '?'}`)
      fetch('/api/mail/pending').then(r => r.json())
          .then(r => {
            if (r.authenticate) {
              setGmailAuthenticateURL(r.authenticate)
            }
            if (r.notSupported) {
              setGmailUnsupported(true)
            }
            setGmailAddress(r.emailAddress)
            setPendingMail(r.pendingThreads ?? '?')
          })
    }
  }

  function authenticate() {
    if (gmailAuthenticateURL) {
      window.location.href = gmailAuthenticateURL
    }
  }
  function fileImportButton(iconName : string, pending : number | string, title: string) {
    return (
        <>
          <div className="badge" style={{'visibility': pending==0 ? 'hidden' : 'visible'}} >{pending}</div>
          <Icon title={title} className='CommandButton' iconName={iconName}/>
        </>
    );
  }

  function logout() {
    props.sso?.logout().then(() =>
        fetch('/api/logout').then(
        ).then(() => {
              window.location.hash = ''
              window.location.pathname = ''
              window.location.reload()
            }
        ))
  }
  return <Stack horizontal verticalAlign='baseline' className='CommandBar'>
    <Persona {...props.loggedIn} size={PersonaSize.size24} onContextMenu={e => {
      e.preventDefault()
      setPersonaCMElement(e.target as Element)
    }} onClick={e => setPersonaCMElement(e.target as Element)}/>
    <IconButton className="Command" title='File Import' iconProps={{'iconName':'scanner'}} text='File Import' onRenderIcon={() => fileImportButton('scanner', pendingImport, 'File Import')} onMouseEnter={() => refreshPendingCount(true)} onClick={() => importFiles()}/>
    <IconButton className="Command" title="Mail Import" hidden={gmailUnsupported} iconProps={{'iconName': 'Mail'}} text="Mail Import" onRenderIcon={() => fileImportButton('Mail', pendingMail ?? '?', 'Mail Import')} onClick={e => setGmailCMElement(e.target as Element)} onContextMenu={e => {
      e.preventDefault()

    }}/>
    <IconButton className="Command" title="Dark Mode" iconProps={{'iconName' : props.isDark ? 'light-mode-symbol-svg' : 'dark-mode-symbol-svg'}} text="Dark Mode" onClick={props.onDarkChanged}/>
    <IconButton className="Command" title={getRTL() ? "LTR" : "RTL"} iconProps={{'iconName': getRTL() ? "AlignLeft" : "AlignRight"}} text="RTL" onClick={() => setRTL(!getRTL(), true)}/>
    <ContextualMenu
        items={[{key: 'logout', text: 'Logout', onClick: () => logout()}]}
        hidden={!personaCMElement}
        target={personaCMElement}
        onDismiss={() => setPersonaCMElement(undefined)}
    />
    <ContextualMenu items={[{key: 'login', text: gmailAddress || 'Login', onClick: () => authenticate(), disabled: !gmailAuthenticateURL},
      {key: 'import', text: 'Import...', onClick: () => importMail(), iconProps: { iconName: 'MailLowImportance'}, disabled: !(pendingMail > 0)}]}
                    hidden={!gmailCMElement}
                    target={gmailCMElement}
                    onDismiss={() => setGmailCMElement(undefined)}
    />
  </Stack>;
}
