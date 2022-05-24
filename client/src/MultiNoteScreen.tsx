import React from "react";
import {CommandBar, ICommandBarItemProps, ITag,  Stack} from "@fluentui/react";
import eventBus from "./EventBus";

export const MultiNoteScreen: React.FunctionComponent<{selectedNotes: Set<number>, availableNotebooks: ITag[] | undefined, filterId: string | undefined}> = (props: {selectedNotes: Set<number>, availableNotebooks: ITag[] | undefined, filterId: string | undefined}) => {

  const doDelete = () => {
    const requestOptions = {
      method: 'DELETE' }
    fetch('api/notes/' + Array.from(props.selectedNotes).join(','), requestOptions).then(() => {
      let affectedList = { notebooks : [3], tags: [0]}
      if (props.filterId) {
        if (props.filterId.split('/')[0] == 'notebooks') {
          affectedList.notebooks.push(Number(props.filterId.split('/')[1]))
        } else {
          affectedList.tags = [Number(props.filterId.split('/')[1])];
        }
      }
      eventBus.dispatch('note-collection-change', affectedList)
    })
  }

  const doMove = (notebook: string | number) => {
    const requestOptions = {
      method: 'POST' }
    fetch(`api/notes/${Array.from(props.selectedNotes).join(',')}/notebook/${notebook}`, requestOptions).then(() => {
      let affectedList = { notebooks : [notebook], tags: [0]}
      if (props.filterId) {
        if (props.filterId.split('/')[0] == 'notebooks') {
          affectedList.notebooks.push(Number(props.filterId.split('/')[1]))
        } else {
          affectedList.tags = [Number(props.filterId.split('/')[1])];
        }
      }
      eventBus.dispatch('note-collection-change', affectedList)
    })
  }

  return (
      <>
        <div style={{flex: 1}}/>
        <Stack className='MultiNote' horizontalAlign='center' verticalAlign='center'>
          <img className='MultiFolderIcon' src={'multipleNotes.svg'}/>
          <CommandBar items={[{
            key: 'merge',
            text: 'Merge Items',
            iconProps: {iconName: 'Merge'}
          },
            {
              key: 'delete',
              text: 'Delete ' + props.selectedNotes.size + ' Notes',
              iconProps: {iconName: 'Delete'},
              onClick: () => doDelete()
            },
            {
              key: 'move',
              text: 'Move ' + props.selectedNotes.size + ' Notes...',
              iconProps: { iconName: 'Folder'},
              subMenuProps: {
                items: props.availableNotebooks?.map(n => {
                  return  {
                    key: n.key,
                    text: n.name,
                    iconProps: {iconName: 'Inbox'},
                    onClick: () => doMove(n.key)
                  } as ICommandBarItemProps}) ?? []
              }
            }]}/>
        </Stack>
        <div style={{flex: 1}}/>

      </>
  )
}
