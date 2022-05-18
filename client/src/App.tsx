import React from 'react';
import {
  BaseButton,
  CommandBar,
  DatePicker,
  defaultDatePickerStrings,
  DocumentCard,
  DocumentCardActivity,
  DocumentCardDetails,
  DocumentCardStatus,
  DocumentCardTitle,
  FontWeights,
  IButtonStyles,
  ICommandBarItemProps,
  IconButton,
  IDatePicker,
  INavLink,
  INavLinkGroup,
  initializeIcons,
  IOverflowSetItemProps,
  IStackStyles,
  IStackTokens,
  ITextStyles,
  IToggleStyles,
  Nav,
  OverflowSet,
  SearchBox,
  Stack,
  TextField
} from '@fluentui/react';
import './App.css';


// Initialize icons in case this example uses them
initializeIcons();

const toggleStyles: Partial<IToggleStyles> = { root: { marginBottom: '20px' } };
const groupCount = 3;
const groupDepth = 3;



const createTags = () => {
  return [{ count: 1, key: 'archive', name: 'Archive', level: 0, isCollapsed: true, children: [], startIndex: 0},
    {count: 2, key: 'tags', name: 'Tags', level: 0, isCollapsed: false, startIndex: 0, children: [
        {count: 3, key: 'who', name: 'Who', level: 1, isCollapsed: false, startIndex: 0, children: [
            { count: 10, key: 'uri', name: 'אורי', level: 2, isCollapsed: true, startIndex: 0, children: []},
            { count: 10, key: 'yael', name: 'יעל', level: 2, isCollapsed: true, startIndex: 0, children: []},
            { count: 1, key: 'lior', name: 'ליאור', level: 2, isCollapsed: true, startIndex: 0, children: []},
          ]}
      ]}]
}

const navTags: INavLinkGroup[] = [
  {
    name: "Notebooks",
    links: [{name: 'Archive (3582)', key: 'archive', url: '',
      icon: 'Inbox'}, {name: 'To Sort (30)', key: 'to-sort', url: '#',
      icon: "Inbox"}],
  },
  {
    name: 'Tags',
    links:  [
          {
            count: 3,
            key: 'who',
            name: 'Who',
            level: 1,
            isCollapsed: false,
            startIndex: 0, url: '', icon: 'Tag',
            links: [
              {
                count: 10,
                key: 'uri',
                name: ' (120)אורי',
                level: 2,
                isCollapsed: true,
                startIndex: 0, url: '',
                icon: 'Tag',
                links: [
                  {
                    key: 'test',
                    name: 'Test',
                    url: '',
                    icon: 'Tag'
                  }
                ]
              },
              {
                count: 10,
                key: 'yael',
                name: 'יעל',
                level: 2,
                isCollapsed: true,
                startIndex: 0, url: '',
                children: [], icon: 'Tag'
              },
              {
                count: 1,
                key: 'lior',
                name: 'ליאור',
                level: 2,
                isCollapsed: true,
                startIndex: 0, url: '',
                children: [], icon: 'Tag'
              },
            ]
          }
        ]
  }
]


const groups = createTags();

export const TagList: React.FunctionComponent = () => {
  const [tagList, setTagList] = React.useState<INavLinkGroup[]>( [{
        name: "Notebooks",
        links: [{name: 'Archive (3582)', key: 'archive', url: '',
          icon: 'Inbox'}, {name: 'To Sort (30)', key: 'to-sort', url: '#',
          icon: "Inbox"}],
      }]);
  React.useEffect(() => {
    fetch("/api/tags")
        .then((res) => res.json())
        .then((data) => {
          let links : INavLink[] = [];
          let tags :INavLink[] = [];
          for (let i = 0; i < data.tags.length; i++) {
            let tag = data.tags[i];
            tags[tag.id] = { key: tag.id, name: tag.name + (tag.notes ? " (" + tag.notes + ")" : ""), icon: 'Tag', isExpanded: true, url: '#', links: []}
          }
          for (let i = 0; i < data.tags.length; i++) {
            let current = tags[data.tags[i].id]
            if (data.tags[i].parent == 0) {
              links.push(current);
              //current.level = 1;
            } else {
              // console.log(tags[data.tags[i].parent])
              tags[data.tags[i].parent]?.links?.push(current)
              //current.level = tags[data.tags[i].parent].level + 1;
            }

          }

          setTagList([tagList[0], {
            name: 'Tags',
              links: links,
        }]);
        });
  }, []);
  return (
      <div className='TagList'>
        <Nav
            groups={tagList}
        />
      </div>
  );
}

// export const TagList: React.FunctionComponent = () => {
//   const [isCompactMode, { toggle: toggleIsCompactMode }] = useBoolean(false);
//   const selection = useConst(() => {
//     const s = new Selection();
//     // s.setItems(items, true);
//     return s;
//   });
//
//   const onRenderCell = (
//       nestingDepth?: number,
//       item?: IExampleItem,
//       itemIndex?: number,
//       group?: IGroup,
//   ): React.ReactNode => {
//     return 'item';
//   };
//
//   return (
//       <div className='TagList'>
//           <GroupedList
//               items={[]}
//               onRenderCell={onRenderCell}
//               selection={selection}
//               selectionMode={SelectionMode.single}
//               groups={groups}
//               compact={isCompactMode}
//           />
//       </div>
//   );
// }
const boldStyle: Partial<ITextStyles> = { root: { fontWeight: FontWeights.semibold } };
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
const onRenderItem = (item: IOverflowSetItemProps): JSX.Element => {
  return (
      <BaseButton text={item.name}/>
  );
}

const onRenderOverflowButton = (overflowItems: any[] | undefined): JSX.Element => {
  const buttonStyles: Partial<IButtonStyles> = {
    root: {
      minWidth: 0,
      padding: '0 4px',
      alignSelf: 'stretch',
      height: 'auto',
    },
  };
  return (
      <IconButton
          role="menuitem"
          title="More options"
          styles={buttonStyles}
          menuIconProps={{ iconName: 'More' }}
          menuProps={{ items: overflowItems! }}
      />
  );
};

export const App: React.FunctionComponent = () => {
  const datePickerRef = React.useRef<IDatePicker>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());

  return (
      <Stack tokens={stackTokens} styles={stackStyles}>
        <Stack horizontal verticalAlign='baseline'>
        <BaseButton className='Hamburger'>
          <svg viewBox="0 0 18 18" width="100%"  preserveAspectRatio="xMidYMid meet" focusable="false">
            <path d="M2 13.5h14V12H2v1.5zm0-4h14V8H2v1.5zM2 4v1.5h14V4H2z"/>
          </svg>
        </BaseButton>
        <h1 className='App-header'>Paperless</h1>
          <SearchBox className='SearchBox' placeholder='Search Paperless'/>
          <CommandBar className='CommandBar' items={_menuItems}/>
        </Stack>
        <Stack horizontal className='MainView'>
          <TagList />
          <Stack horizontalAlign='start' verticalAlign='start' className='ListView'>
            <DocumentCard className='ListItem'>
              <DocumentCardDetails>
                <DocumentCardTitle title='Google Paycheck'/>
                <DocumentCardStatus status="1 Attachment (120kb)" statusIcon="attach"/>
                <DocumentCardActivity activity='Updated: May 23rd 2022' people={[{name: 'Uri', profileImageSrc: ''}]}/>
              </DocumentCardDetails>
            </DocumentCard>
            <DocumentCard className='ListItem'>
              <DocumentCardDetails>
                <DocumentCardTitle title='Google Paycheck March'/>
                <DocumentCardStatus status="1 Attachment (220kb)" statusIcon="attach"/>
                <DocumentCardActivity activity='Updated: April 23rd 2022' people={[{name: 'Uri', profileImageSrc: ''}]}/>
              </DocumentCardDetails>
            </DocumentCard>
          </Stack>
          <Stack className='DetailCard'>
            <Stack horizontalAlign='stretch' verticalAlign='center' horizontal className='CardRow1'>
              <span>Name:&nbsp;</span>
              <TextField value='Google Paycheck' className='TitleField'/>
              <span>Date:&nbsp;</span>
              <DatePicker
                  componentRef={datePickerRef}
                  className='DateField'
                  // label="Start date"
                  allowTextInput
                  ariaLabel="Select a date"
                  value={selectedDate}
                  // onSelectDate={setValue as (date: Date | null | undefined) => void}
                  // className={styles.control}
                  // DatePicker uses English strings by default. For localized apps, you must override this prop.
                  strings={defaultDatePickerStrings}
              />
            </Stack>
            <OverflowSet className="ItemTags" onRenderItem={onRenderItem} onRenderOverflowButton={onRenderOverflowButton} items={
              [{key: "uri", name: "אורי"},
                  {key: "uri1", name:'גוגל',},
                {key: "uri2", name:'משכורת'}]}/>

            <iframe className='BodyField' src='text.html'/>
          </Stack>
        </Stack>
      </Stack>
  );
};
