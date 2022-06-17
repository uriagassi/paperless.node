import React, {createRef, useEffect, useRef, useState} from "react";
import {
  ContextualMenu,
  Dialog,
  DialogType,
  Stack,
  ITag, TextField, Label, DialogFooter, PrimaryButton, DefaultButton, ITextField
} from "@fluentui/react";
import {useBoolean} from '@fluentui/react-hooks';
import {ITagWithChildren} from "./TagList";
import eventBus from "./EventBus";


const dragOptions = {
  moveMenuItemText: 'Move',
  closeMenuItemText: 'Close',
  menu: ContextualMenu,
};
export const AddNotebookDialog: React.FunctionComponent<
    {
      show: boolean
      availableNotebooks: ITagWithChildren[] | undefined,
      onClose: () => any }> =
    (props) => {
      const [hideDialog, {toggle: toggleHideDialog}] = useBoolean(true);
      const [notebookName, setNotebookName] = useState<string>()
      const [tagNameErrorMessage, setTagNameErrorMessage] = useState<string|undefined>()

      const textField = createRef<ITextField>()


      useEffect(() => {
        if (props.show) {
          toggleHideDialog()
        }
      }, [props.show])


      const cancelChange = () => {
        toggleHideDialog()
        props.onClose()
      }
      let nameChanged = (e : any, newValue?: string) => {
        if (props.availableNotebooks?.find(t => newValue == t.name)) {
          setTagNameErrorMessage("Name already exists")
        } else {
          setTagNameErrorMessage(undefined)
        }
        setNotebookName(newValue)
      };

      let doAdd = () => {
        if (tagNameErrorMessage) {
          textField.current?.focus();
          return;
        }
        if (notebookName) {
          fetch(`/api/notebooks/${notebookName}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
          }).then((r) => {
            console.log(r)
            eventBus.dispatch('note-collection-change', { notebooks: notebookName })
            toggleHideDialog()
            props.onClose()
          })
        }
      }

      return (
          <Dialog className='TagDialog' hidden={hideDialog} onDismiss={cancelChange} modalProps={{isBlocking: true, dragOptions: dragOptions}} dialogContentProps={{type: DialogType.normal, title: 'Add Notebook'}} >
            <Stack>
              <TextField componentRef={textField} label="Tag Name:" value={notebookName} onChange={nameChanged} errorMessage={tagNameErrorMessage}/>
            </Stack>
            <DialogFooter>
              <PrimaryButton text='Add' onClick={doAdd}/>
              <DefaultButton text='Cancel' onClick={cancelChange}/>
            </DialogFooter>
          </Dialog>
      )
    }
