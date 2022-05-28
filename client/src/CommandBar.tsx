import React from "react";
import {Icon, IconButton, Persona, PersonaSize, Stack} from "@fluentui/react";
import eventBus from "./EventBus";

const MINUTE_MS = 600000;


export class CommandBar extends React.Component<{loggedIn: {imageInitials: string, text: string}}, { pendingImport: number, pendingMail: number }> {
  constructor(props: any) {
    super(props);
    this.state = { pendingImport: 0, pendingMail: 0}
    this.fileImportButton = this.fileImportButton.bind(this)
    this.refreshPendingCount = this.refreshPendingCount.bind(this)
    this.importFiles = this.importFiles.bind(this)
  }


  componentDidMount() {
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
    this.refreshPendingCount()
    const interval = setInterval(() => {
      this.refreshPendingCount()
    }, MINUTE_MS)
    return () => clearInterval(interval);
  }

  render() {
    return <Stack horizontal verticalAlign='baseline'>
      <IconButton className="Command" title="Mail Import" iconProps={{'iconName': 'Mail'}} text="Mail Import" onRenderIcon={() => this.fileImportButton('Mail', this.state.pendingMail)} onClick={() => this.importMail()}/>
      <IconButton className="Command" title='File Import' iconProps={{'iconName':'CloudImportExport'}} text='File Import' onRenderIcon={() => this.fileImportButton('CloudImportExport', this.state.pendingImport)} onMouseEnter={() => this.refreshPendingCount()} onClick={() => this.importFiles()}/>
      <Persona {...this.props.loggedIn} size={PersonaSize.size40}/>
    </Stack>;
  }

  private importFiles() {
    fetch('/api/files/import').then(r => {
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
      this.refreshPendingCount()
    })
  }

  private importMail() {
    fetch('/api/mail/import').then(r => r.json()).then(r => {
      if (r.authenticate) {
        window.location.href = r.authenticate
      }
    })
  }

  private refreshPendingCount() {
    fetch('/api/files/checkStatus').then(result => result.json())
        .then(r => this.setState({...this.state, pendingImport: r.pending}))
    fetch('/api/mail/pending').then(r => r.json())
        .then(r => {
          if (r.authenticate) {
            window.location.href = r.authenticate
          }
          this.setState({...this.state, pendingMail: r.pendingThreads })
        })
  }

  private fileImportButton(iconName : string, pending : number) {
    return (
        <>
          <div className="badge" style={{'visibility': pending==0 ? 'hidden' : 'visible'}} >{pending}</div>
          <Icon title='File Import' className='CommandButton' iconName={iconName}/>
        </>
    );
  }
}
