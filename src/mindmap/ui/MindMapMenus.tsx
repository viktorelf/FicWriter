import {
  DefaultContextMenu,
  DefaultMainMenu,
  ArrangeMenuSubmenu,
  ReorderMenuSubmenu,
  MoveToPageMenu,
  ClipboardMenuGroup,
  TldrawUiMenuGroup,
  TldrawUiMenuSubmenu,
  UndoRedoGroup,
  MiscMenuGroup,
  ToggleLockMenuItem,
  UnlockAllMenuItem,
  SelectAllMenuItem,
  ViewSubmenu,
  ExtrasGroup,
  PreferencesGroup,
  HelpGroup,
} from "tldraw";

export function MindMapContextMenu() {
  return (
    <DefaultContextMenu>
      <TldrawUiMenuGroup id="modify">
        <ArrangeMenuSubmenu />
        <ReorderMenuSubmenu />
        <MoveToPageMenu />
      </TldrawUiMenuGroup>
      <ClipboardMenuGroup />
      <TldrawUiMenuGroup id="select-all">
        <SelectAllMenuItem />
      </TldrawUiMenuGroup>
    </DefaultContextMenu>
  );
}

export function MindMapMainMenu() {
  return (
    <DefaultMainMenu>
      <TldrawUiMenuSubmenu id="edit" label="menu.edit">
        <UndoRedoGroup />
        <ClipboardMenuGroup />
        <MiscMenuGroup />
        <TldrawUiMenuGroup id="lock">
          <ToggleLockMenuItem />
          <UnlockAllMenuItem />
        </TldrawUiMenuGroup>
        <TldrawUiMenuGroup id="select-all">
          <SelectAllMenuItem />
        </TldrawUiMenuGroup>
      </TldrawUiMenuSubmenu>
      <ViewSubmenu />
      <ExtrasGroup />
      <PreferencesGroup />
      <HelpGroup />
    </DefaultMainMenu>
  );
}
