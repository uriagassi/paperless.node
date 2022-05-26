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
import {Dropdown, DropdownItemProps, DropdownProps} from "semantic-ui-react";
import eventBus from "./EventBus";


const dragOptions = {
  moveMenuItemText: 'Move',
  closeMenuItemText: 'Close',
  menu: ContextualMenu,
};
export const UpdateTagDialog: React.FunctionComponent<
    { tag: ITagWithChildren | undefined,
      availableTags: ITagWithChildren[] | undefined,
      onClose: () => any }> =
    (props: { tag: ITagWithChildren | undefined,
      availableTags: ITagWithChildren[] | undefined,
      onClose: () => any}) => {
      const [hideDialog, {toggle: toggleHideDialog}] = useBoolean(true);
      const [parentOptions, setParentOptions] = useState<DropdownItemProps[]>([]);
      const [currentTag, setCurrentTag] = useState<ITagWithChildren | undefined>()
      const [tagNameErrorMessage, setTagNameErrorMessage] = useState<string|undefined>()

      const textField = createRef<ITextField>()

      const notChildOfSelected = (tag : ITagWithChildren | undefined) : boolean => {
        if (!tag) return true;
        if (Number(tag.key) == Number(props.tag?.key)) {
          return false;
        }
        if (Number(tag.parent) == 0) {
          return true;
        }
        return notChildOfSelected(props.availableTags?.find(t => Number(t.key) == Number(tag.parent)))
      }

      useEffect(() => {
        console.log("show?")
        if (props.tag) {
          console.log("show!")
          toggleHideDialog()
          setCurrentTag({...props.tag})
        }
      }, [props.tag])

      useEffect(() => {
        let availableParents : DropdownItemProps[] = [{value: 0, text: '<root>'}];
        if (props.tag && props.availableTags) {
          props.availableTags.filter(notChildOfSelected).forEach(t => {
                availableParents = availableParents.concat({value: t.key, text: t.name} as DropdownItemProps)
              }
          )
        }
        setParentOptions(availableParents)
      }, [props.tag, props.availableTags]);

      const cancelChange = () => {
        toggleHideDialog()
        props.onClose()
      }
      let nameChanged = (e : any, newValue?: string) => {
        if (newValue != props.tag?.name && props.availableTags?.find(t => newValue == t.name)) {
          setTagNameErrorMessage("Name already exists")
        } else {
          setTagNameErrorMessage(undefined)
        }
        if (currentTag) {
          setCurrentTag({...currentTag, name:newValue ?? ''})
        }
      };

      let parentChanged = (e : any, data: DropdownProps) => {
        if (currentTag) setCurrentTag({...currentTag, parent: Number(data.value)})
      }

      let doUpdate = () => {
        if (tagNameErrorMessage) {
          textField.current?.focus();
          return;
        }
        if (currentTag) {
          fetch(`/api/tags/${currentTag.key}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name: currentTag.name,
              parent: currentTag.parent ?? 0
            })
          }).then((r) => {
            console.log(r)
            eventBus.dispatch('note-collection-change', { tags: [currentTag.key, currentTag.parent]})
            toggleHideDialog()
            props.onClose()
          })
        }
      }

      return (
          <Dialog className='TagDialog' hidden={hideDialog} onDismiss={cancelChange} modalProps={{isBlocking: true, dragOptions: dragOptions}} dialogContentProps={{type: DialogType.normal, title: 'Update Tag'}} >
            <Stack>
              <TextField componentRef={textField} label="Tag Name:" value={currentTag?.name} onChange={nameChanged} errorMessage={tagNameErrorMessage}/>
              <Label>Parent:</Label>
              <Dropdown options={parentOptions} search selection placeholder='Parent' value={currentTag?.parent} onChange={parentChanged}/>
            </Stack>
            <DialogFooter>
              <PrimaryButton text='Update' onClick={doUpdate}/>
              <DefaultButton text='Cancel' onClick={cancelChange}/>
            </DialogFooter>
          </Dialog>
      )
    }
