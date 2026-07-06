import {
  DefaultMainMenu,
  EditSubmenu,
  ViewSubmenu,
  ExtrasGroup,
  PreferencesGroup,
  HelpGroup,
  type TLUiMainMenuProps,
} from "tldraw";

export function BoardMainMenu(props: TLUiMainMenuProps) {
  return (
    <DefaultMainMenu {...props}>
      <EditSubmenu />
      <ViewSubmenu />
      <ExtrasGroup />
      <PreferencesGroup />
      <HelpGroup />
    </DefaultMainMenu>
  );
}
