import React from "react";
import {Icon, IconButton, Persona, PersonaSize, Stack} from "@fluentui/react";
import eventBus from "./EventBus";

const MINUTE_MS = 60000;


export class CommandBar extends React.Component<{loggedIn: {imageInitials: string, text: string}}, { pendingImport: number}> {
  constructor(props: any) {
    super(props);
    this.state = { pendingImport: 0}
    this.fileImportButton = this.fileImportButton.bind(this)
    this.refreshPendingCount = this.refreshPendingCount.bind(this)
    this.importFiles = this.importFiles.bind(this)
  }


  componentDidMount() {
    this.refreshPendingCount()
    const interval = setInterval(() => {
      this.refreshPendingCount()
    }, MINUTE_MS)
    return () => clearInterval(interval);
  }

  render() {
    return <Stack horizontal verticalAlign='baseline'>
      <IconButton className="Command" title='File Import' iconProps={{'iconName':'CloudImportExport'}} text='File Import' onRenderIcon={this.fileImportButton} onMouseEnter={() => this.refreshPendingCount()} onClick={() => this.importFiles()}/>
      <Persona {...this.props.loggedIn} size={PersonaSize.size40}/>
    </Stack>;
  }

  private importFiles() {
    fetch('/api/files/import').then(r => {
      eventBus.dispatch('note-collection-change', { notebooks: [2]})
      this.refreshPendingCount()
    })
  }

  private fileImportButton(props : any) {
    return (
        <>
          <div className="badge" style={{'visibility': this.state.pendingImport==0 ? 'hidden' : 'visible'}} >{this.state.pendingImport}</div>
          <Icon title='File Import' className='CommandButton' iconName='CloudImportExport'/>
        </>
    );
  }

  private refreshPendingCount() {
    fetch('/api/files/checkStatus').then(result => result.json())
        .then(r => this.setState({pendingImport: r.pending}))
  }
}
