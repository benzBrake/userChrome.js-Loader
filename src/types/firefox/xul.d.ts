/**
 * Common XUL elements suitable for browser-chrome user scripts.
 *
 * This deliberately covers reusable UI primitives. Components that require
 * browser-owned lifecycle management, such as tabbrowser and notificationbox,
 * are declared with their owning browser APIs instead.
 */

type XULPopupState = "closed" | "showing" | "open" | "hiding";

interface XULBoxElement extends XULElement {
  collapsed: boolean;
  flex: number;
}

interface XULLabelElement extends XULElement {
  value: string;
  accessKey: string;
}

interface XULDescriptionElement extends XULElement {
  value: string;
}

interface XULImageElement extends XULElement {
  src: string;
}

interface XULPopupElement extends XULElement {
  readonly state: XULPopupState;
  triggerNode: Element | null;
  openPopup(
    anchor?: Element | null,
    position?: string,
    x?: number,
    y?: number,
    isContextMenu?: boolean,
    attributesOverride?: boolean,
    triggerEvent?: Event | null,
  ): void;
  openPopupAtScreen(x: number, y: number, isContextMenu?: boolean, triggerEvent?: Event | null): void;
  hidePopup(cancel?: boolean): void;
  moveTo(x: number, y: number): void;
}

interface XULPanelElement extends XULPopupElement {}

interface XULTooltipElement extends XULPopupElement {}

interface XULMenuPopupElement extends XULPopupElement {
  activateItem(item: XULMenuItemElement): void;
}

interface XULMenuItemElement extends XULElement {
  label: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  checked: boolean;
}

interface XULMenuElement extends XULElement {
  label: string;
  open: boolean;
  readonly itemCount: number;
  readonly menupopup: XULMenuPopupElement | null;
  appendItem(label: string, value: string): XULMenuItemElement;
  getItemAtIndex(index: number): XULMenuItemElement | null;
  getIndexOfItem(item: XULMenuItemElement): number;
}

interface XULMenuListElement extends XULElement {
  value: string;
  selectedIndex: number;
  selectedItem: XULMenuItemElement | null;
  readonly itemCount: number;
  readonly menupopup: XULMenuPopupElement | null;
  appendItem(label: string, value: string): XULMenuItemElement;
  getItemAtIndex(index: number): XULMenuItemElement | null;
  getIndexOfItem(item: XULMenuItemElement): number;
}

interface XULToolbarElement extends XULElement {
  collapsed: boolean;
}

type XULToolbarButtonType = "button" | "menu" | "menu-button" | "checkbox" | "radio";

interface XULToolbarButtonElement extends XULElement {
  label: string;
  image: string;
  checked: boolean;
  disabled: boolean;
  type: XULToolbarButtonType;
  open: boolean;
  readonly menupopup: XULMenuPopupElement | null;
}

interface XULButtonElement extends XULElement {
  label: string;
  disabled: boolean;
}

interface XULCheckboxElement extends XULButtonElement {
  checked: boolean;
}

interface XULRadioElement extends XULButtonElement {
  selected: boolean;
}

interface XULRadioGroupElement extends XULElement {
  selectedIndex: number;
  selectedItem: XULRadioElement | null;
}

/** A panel's view stack; use the global PanelMultiView API to navigate it. */
interface XULPanelMultiViewElement extends XULElement {}

interface XULPanelViewElement extends XULBoxElement {}

/**
 * Tags for which Firefox exposes a useful element-specific API.
 * Unknown XUL tags still resolve to the base XULElement overload.
 */
interface XULTagNameMap {
  box: XULBoxElement;
  hbox: XULBoxElement;
  vbox: XULBoxElement;
  stack: XULBoxElement;
  spacer: XULBoxElement;
  label: XULLabelElement;
  description: XULDescriptionElement;
  image: XULImageElement;
  popupset: XULElement;
  panel: XULPanelElement;
  tooltip: XULTooltipElement;
  menu: XULMenuElement;
  menupopup: XULMenuPopupElement;
  menuitem: XULMenuItemElement;
  menuseparator: XULElement;
  menucaption: XULLabelElement;
  menulist: XULMenuListElement;
  toolbar: XULToolbarElement;
  toolbaritem: XULElement;
  toolbarbutton: XULToolbarButtonElement;
  toolbarseparator: XULElement;
  toolbarspacer: XULElement;
  button: XULButtonElement;
  checkbox: XULCheckboxElement;
  radio: XULRadioElement;
  radiogroup: XULRadioGroupElement;
  panelmultiview: XULPanelMultiViewElement;
  panelview: XULPanelViewElement;
}

interface Document {
  createXULElement<K extends keyof XULTagNameMap>(
    tagName: K,
    options?: ElementCreationOptions,
  ): XULTagNameMap[K];
  createXULElement(tagName: string, options?: ElementCreationOptions): XULElement;
}
