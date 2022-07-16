import React, { createRef, useEffect, useState } from "react";
import {
  ContextualMenu,
  Dialog,
  DialogType,
  Stack,
  TextField,
  Label,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  ITextField,
} from "@fluentui/react";
import { useBoolean } from "@fluentui/react-hooks";
import { ITagWithChildren } from "./TagList";
import { Dropdown, DropdownItemProps, DropdownProps } from "semantic-ui-react";
import eventBus from "./EventBus";
import { ServerAPI } from "./ServerAPI";

const dragOptions = {
  moveMenuItemText: "Move",
  closeMenuItemText: "Close",
  menu: ContextualMenu,
};
interface UpdateTagDialogProps {
  tag: ITagWithChildren | undefined;
  availableTags: ITagWithChildren[] | undefined;
  onClose: (s: string | undefined) => unknown;
  api: ServerAPI | undefined;
}

export const UpdateTagDialog: React.FunctionComponent<UpdateTagDialogProps> = (props) => {
  const [hideDialog, { toggle: toggleHideDialog }] = useBoolean(true);
  const [parentOptions, setParentOptions] = useState<DropdownItemProps[]>([]);
  const [currentTag, setCurrentTag] = useState<ITagWithChildren | undefined>();
  const [tagNameErrorMessage, setTagNameErrorMessage] = useState<string | undefined>();

  const textField = createRef<ITextField>();

  const notChildOfSelected = (tag: ITagWithChildren | undefined): boolean => {
    if (!tag) return true;
    if (+tag.key === Number(props.tag?.key)) {
      return false;
    }
    if (Number(tag.parent) === 0) {
      return true;
    }
    return notChildOfSelected(props.availableTags?.find((t) => +t.key === Number(tag.parent)));
  };

  useEffect(() => {
    if (props.tag) {
      toggleHideDialog();
      setCurrentTag({ ...props.tag });
    }
  }, [props.tag]);

  useEffect(() => {
    let availableParents: DropdownItemProps[] = [{ value: 0, text: "<root>" }];
    if (props.tag && props.availableTags) {
      props.availableTags.filter(notChildOfSelected).forEach((t) => {
        availableParents = availableParents.concat({
          value: t.key,
          text: t.name,
        } as DropdownItemProps);
      });
    }
    setParentOptions(availableParents);
  }, [props.tag, props.availableTags]);

  const cancelChange = () => {
    toggleHideDialog();
    props.onClose(undefined);
  };
  const nameChanged = (_e: unknown, newValue?: string) => {
    if (newValue != props.tag?.name && props.availableTags?.find((t) => newValue == t.name)) {
      setTagNameErrorMessage("Name already exists");
    } else {
      setTagNameErrorMessage(undefined);
    }
    if (currentTag) {
      setCurrentTag({ ...currentTag, name: newValue ?? "" });
    }
  };

  const parentChanged = (_e: unknown, data: DropdownProps) => {
    if (currentTag) setCurrentTag({ ...currentTag, parent: Number(data.value) });
  };

  const doUpdate = async () => {
    if (tagNameErrorMessage) {
      textField.current?.focus();
      return;
    }
    if (currentTag) {
      const r = await props.api?.updateTag(currentTag);
      console.log(r);
      eventBus.dispatch("note-collection-change", {
        tags: [currentTag.key, currentTag.parent],
      });
      toggleHideDialog();
      props.onClose(r?.key);
    }
  };

  return (
    <Dialog
      className="TagDialog"
      hidden={hideDialog}
      onDismiss={cancelChange}
      modalProps={{ dragOptions: dragOptions }}
      dialogContentProps={{ type: DialogType.normal, title: "Update Tag" }}
    >
      <Stack
        onKeyUp={(e) => {
          if (e.key === "Enter") doUpdate();
        }}
      >
        <TextField
          componentRef={textField}
          label="Tag Name:"
          value={currentTag?.name}
          onChange={nameChanged}
          errorMessage={tagNameErrorMessage}
        />
        <Label>Parent:</Label>
        <Dropdown
          options={parentOptions}
          search
          selection
          placeholder="Parent"
          value={currentTag?.parent}
          onChange={parentChanged}
        />
      </Stack>
      <DialogFooter>
        <PrimaryButton text="Update" onClick={doUpdate} />
        <DefaultButton text="Cancel" onClick={cancelChange} />
      </DialogFooter>
    </Dialog>
  );
};
