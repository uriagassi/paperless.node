import React, { createRef, useEffect, useState } from "react";
import {
  ContextualMenu,
  Dialog,
  DialogType,
  Stack,
  TextField,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  ITextField,
} from "@fluentui/react";
import { useBoolean } from "@fluentui/react-hooks";
import eventBus from "./EventBus";
import { ServerAPI, Notebook } from "./ServerAPI";

const dragOptions = {
  moveMenuItemText: "Move",
  closeMenuItemText: "Close",
  menu: ContextualMenu,
};
export const AddNotebookDialog: React.FunctionComponent<{
  show: boolean;
  availableNotebooks: Notebook[] | undefined;
  onClose: () => unknown;
  api?: ServerAPI;
}> = (props) => {
  const [hideDialog, { toggle: toggleHideDialog }] = useBoolean(true);
  const [notebookName, setNotebookName] = useState<string>();
  const [tagNameErrorMessage, setTagNameErrorMessage] = useState<string | undefined>();

  const textField = createRef<ITextField>();

  useEffect(() => {
    if (props.show) {
      toggleHideDialog();
      setNotebookName(undefined);
      setTagNameErrorMessage(undefined);
    }
  }, [props.show]);

  const cancelChange = () => {
    toggleHideDialog();
    props.onClose();
  };
  const nameChanged = (e: unknown, newValue?: string) => {
    if (props.availableNotebooks?.find((t) => newValue == t.name)) {
      setTagNameErrorMessage("Name already exists");
    } else {
      setTagNameErrorMessage(undefined);
    }
    setNotebookName(newValue);
  };

  const doAdd = async () => {
    if (tagNameErrorMessage) {
      textField.current?.focus();
      return;
    }
    if (notebookName) {
      await props.api?.addNotebook(notebookName);
      eventBus.dispatch("note-collection-change", { notebooks: notebookName });
      toggleHideDialog();
      props.onClose();
    }
  };

  return (
    <Dialog
      className="TagDialog"
      hidden={hideDialog}
      onDismiss={cancelChange}
      modalProps={{ dragOptions: dragOptions }}
      dialogContentProps={{ type: DialogType.normal, title: "Add Notebook" }}
    >
      <Stack
        onKeyUp={(e) => {
          if (e.key === "Enter") doAdd();
        }}
      >
        <TextField
          componentRef={textField}
          label="Notebook Name:"
          value={notebookName}
          onChange={nameChanged}
          errorMessage={tagNameErrorMessage}
        />
      </Stack>
      <DialogFooter>
        <PrimaryButton text="Add" onClick={doAdd} />
        <DefaultButton text="Cancel" onClick={cancelChange} />
      </DialogFooter>
    </Dialog>
  );
};
