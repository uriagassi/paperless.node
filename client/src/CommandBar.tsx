import React, {useEffect, useState} from "react";
import {
  ContextualMenu,
  Icon,
  IconButton,
  Persona,
  PersonaSize,
  Stack
} from "@fluentui/react";
import eventBus from "./EventBus";
import {ISSO} from "./sso/ISSO";

const MINUTE_MS = 600000;


export const CommandBar: React.FunctionComponent<{loggedIn: {imageInitials: string, text: string}, sso: ISSO | undefined}> = props => {
  const [pendingImport, setPendingImport] = useState<number>(0)
  const [gmailAuthenticateURL, setGmailAuthenticateURL] = useState<string>()
  const [gmailAddress, setGmailAddress] = useState<string>()
  const [pendingMail, setPendingMail] = useState<number|string>('x')
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
    refreshPendingCount()
    const interval = setInterval(() => {
      refreshPendingCount()
    }, MINUTE_MS)
    return () => clearInterval(interval);
  }, [])

  function importFiles() {
    fetch('/api/files/import').then(r => {
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
      refreshPendingCount()
    })
  }

  function importMail() {
    fetch('/api/mail/import').then(r => r.json()).then(r => {
      if (r.authenticate) {
        window.location.href = r.authenticate
      }
    })
  }

  function refreshPendingCount() {
    fetch('/api/files/checkStatus').then(result => result.json())
        .then(r => setPendingImport(r.pending))
    fetch('/api/mail/pending').then(r => r.json())
        .then(r => {
          if (r.authenticate) {
            setGmailAuthenticateURL(r.authenticate)
          }
          setGmailAddress(r.emailAddress)
          setPendingMail(r.pendingThreads)
        })
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
    <IconButton className="Command" title="Mail Import" iconProps={{'iconName': 'Mail'}} text="Mail Import" onRenderIcon={() => fileImportButton('Mail', pendingMail ?? 'x')} onClick={e => setGmailCMElement(e.target as Element)} onContextMenu={e => {
      e.preventDefault()

    }}/>
    <IconButton className="Command" title='File Import' iconProps={{'iconName':'CloudImportExport'}} text='File Import' onRenderIcon={() => fileImportButton('CloudImportExport', pendingImport)} onMouseEnter={() => refreshPendingCount()} onClick={() => importFiles()}/>
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
