import React, {useEffect, useState} from "react";
import {
  ContextualMenu,
  Icon,
  IconButton,
  Persona,
  PersonaSize, registerIcons,
  Stack
} from "@fluentui/react";
import eventBus from "./EventBus";
import {ISSO} from "./sso/ISSO";

const MINUTE_MS = 600000;

registerIcons({
  icons: {
    'dark-mode-symbol-svg' : (
        <svg height="36px" viewBox="0 0 24 24" width="36px" preserveAspectRatio="xMidYMid meet" focusable="false"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-.89 0-1.74-.2-2.5-.55C11.56 16.5 13 14.42 13 12s-1.44-4.5-3.5-5.45C10.26 6.2 11.11 6 12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6z"/></svg>
    ),
    'light-mode-symbol-svg' : (
        <svg height="36px" viewBox="0 0 24 24" width="36px" preserveAspectRatio="xMidYMid meet" focusable="false"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>
    )

  }
})

export const CommandBar: React.FunctionComponent<{loggedIn: {imageInitials: string, text: string}, isDark: boolean, onDarkChanged: () => any, sso: ISSO | undefined}> = props => {
  const [pendingImport, setPendingImport] = useState<number>(0)
  const [gmailAuthenticateURL, setGmailAuthenticateURL] = useState<string>()
  const [gmailAddress, setGmailAddress] = useState<string>()
  const [pendingMail, setPendingMail] = useState<number|string>('?')
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
    fetch('/api/files/import').then(r => {
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
      refreshPendingCount(false)
    })
  }

  function importMail() {
    fetch('/api/mail/import', {method: 'POST', headers: {'Content-Type': 'application/json'}}).then(r => r.json()).then(r => {
      if (r.authenticate) {
        window.location.href = r.authenticate
      }
      console.log(r)
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
    })
  }

  function refreshPendingCount(force: boolean) {
    fetch('/api/files/checkStatus').then(result => result.json())
        .then(r => setPendingImport(r.pending))
    if (force || pendingMail != '?') {
      console.log(`pendingMail = ${pendingMail}, ${pendingMail == '?'}`)
      fetch('/api/mail/pending').then(r => r.json())
          .then(r => {
            if (r.authenticate) {
              setGmailAuthenticateURL(r.authenticate)
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
  function fileImportButton(iconName : string, pending : number | string) {
    return (
        <>
          <div className="badge" style={{'visibility': pending==0 ? 'hidden' : 'visible'}} >{pending}</div>
          <Icon title='File Import' className='CommandButton' iconName={iconName}/>
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
  return <Stack horizontal verticalAlign='baseline'>
    <IconButton className="Command" title="Dark Mode" iconProps={{'iconName' : props.isDark ? 'light-mode-symbol-svg' : 'dark-mode-symbol-svg'}} text="Dark Mode" onClick={props.onDarkChanged}/>
    <IconButton className="Command" title="Mail Import" iconProps={{'iconName': 'Mail'}} text="Mail Import" onRenderIcon={() => fileImportButton('Mail', pendingMail ?? '?')} onClick={e => setGmailCMElement(e.target as Element)} onContextMenu={e => {
      e.preventDefault()

    }}/>
    <IconButton className="Command" title='File Import' iconProps={{'iconName':'CloudImportExport'}} text='File Import' onRenderIcon={() => fileImportButton('CloudImportExport', pendingImport)} onMouseEnter={() => refreshPendingCount(true)} onClick={() => importFiles()}/>
    <Persona {...props.loggedIn} size={PersonaSize.size40} onContextMenu={e => {
      e.preventDefault()
      setPersonaCMElement(e.target as Element)
    }} onClick={e => setPersonaCMElement(e.target as Element)}/>
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
