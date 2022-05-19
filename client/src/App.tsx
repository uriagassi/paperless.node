import React from 'react';
import {
  BaseButton,
  CommandBar,
  DocumentCard,
  DocumentCardActivity,
  DocumentCardDetails,
  DocumentCardStatus,
  DocumentCardTitle,
  ICommandBarItemProps,
  initializeIcons,
  IStackStyles,
  IStackTokens,
  SearchBox,
  Stack
} from '@fluentui/react';
import './App.css';
import {TagList} from "./TagList";
import {DetailCard} from "./DetailCard";


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
    height: '100%'
  },
};

const _menuItems: ICommandBarItemProps[] = [
  {
    key: 'file',
    text: 'File',
    subMenuProps: {
      items: [
        {key: 'open', text: 'Open'},
        {key: 'save', text: 'Save'},
        {key: 'quit', text: 'Quit'}
      ]
    },
  },
  { key: 'note',
  text: 'Note',
  subMenuProps: {items: []}
  },
  {
    key: 'help',
    text: 'Help',
    subMenuProps: {
      items: [{key: 'about', text: 'About...'}]
    }
  }

]

export const App: React.FunctionComponent = () => {

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
          <SearchBox className='SearchBox' placeholder='Search Paperless'/>
          <CommandBar className='CommandBar' items={_menuItems}/>
        </Stack>
        <Stack horizontal className='MainView'>
          <TagList/>
          <Stack horizontalAlign='start' verticalAlign='start'
                 className='ListView'>
            <DocumentCard className='ListItem'>
              <DocumentCardDetails>
                <DocumentCardTitle title='Google Paycheck'/>
                <DocumentCardStatus status="1 Attachment (120kb)"
                                    statusIcon="attach"/>
                <DocumentCardActivity activity='Updated: May 23rd 2022'
                                      people={[{
                                        name: 'Uri',
                                        profileImageSrc: ''
                                      }]}/>
              </DocumentCardDetails>
            </DocumentCard>
            <DocumentCard className='ListItem'>
              <DocumentCardDetails>
                <DocumentCardTitle title='Google Paycheck March'/>
                <DocumentCardStatus status="1 Attachment (220kb)"
                                    statusIcon="attach"/>
                <DocumentCardActivity activity='Updated: April 23rd 2022'
                                      people={[{
                                        name: 'Uri',
                                        profileImageSrc: ''
                                      }]}/>
              </DocumentCardDetails>
            </DocumentCard>
          </Stack>
          <DetailCard/>
        </Stack>
      </Stack>
  );
};
