/// <reference path="../firefox/index.d.ts" />

/**
 * Ambient declarations for the globals injected by userChrome.js-Loader.
 * Firefox and XPCOM declarations live in firefox/index.d.ts.
 */

interface UserChromeElementAttributes {
  [name: string]: string | number | boolean | ((event: Event) => unknown);
}

interface UserChromeWidgetDescription {
  id: string;
  type?: "toolbarbutton" | "toolbaritem";
  label?: string;
  tooltip?: string;
  image?: string;
  area?: string;
  overflows?: boolean;
  class?: string;
  callback?: (event: Event, targetWindow: Window) => unknown;
  [name: string]: unknown;
}

interface _ucAPI {
  readonly APPNAME: string;
  readonly BROWSERCHROME: string;
  readonly BROWSERTYPE: string;
  readonly BROWSERNAME: string;
  readonly isFaked: boolean;
  readonly isESM: boolean;
  readonly sss: any;
  readonly chromedir: nsIFile;
  windows(
    callback: (document: Document, window: Window, location: string) => unknown,
    onlyBrowsers?: boolean,
  ): void;
  createElement<K extends keyof XULTagNameMap>(
    document: Document,
    tagName: K,
    attributes?: UserChromeElementAttributes,
    isXUL?: true,
  ): XULTagNameMap[K];
  createElement(
    document: Document,
    tagName: string,
    attributes?: UserChromeElementAttributes,
    isXUL?: boolean,
  ): Element;
  createWidget(description: UserChromeWidgetDescription): unknown;
}

interface UserChromePreferenceListener {
  prefPath: string;
  observer: unknown;
}

interface xPreferenceAPI {
  get<T = string | number | boolean | undefined>(
    path: string,
    defaultValue?: T,
    valueIfUndefined?: T,
    setDefault?: boolean,
  ): T;
  set<T = string | number | boolean>(path: string, value: T, defaultValue?: T): T;
  lock<T = string | number | boolean>(path: string, value: T): void;
  unlock(path: string): void;
  clear(path: string): void;
  addListener<T = string | number | boolean>(
    path: string,
    callback: (value: T, prefPath: string) => unknown,
  ): UserChromePreferenceListener;
  removeListener(listener: UserChromePreferenceListener): void;
}

type UserChromeUnloadCallback = (key: string) => unknown;

interface UserChromeSharedUnloadEntry {
  func: UserChromeUnloadCallback;
  context: unknown;
}

interface UserChromeSharedContentMessagePayload<T = unknown> {
  name: string;
  data: T;
  browser: BrowserElement;
  actor: JSWindowActorParent;
}

interface UserChromeSharedContentContext {
  actor: JSWindowActorChild;
  contentDocument: Document | null;
  contentWindow: Window | null;
  event: Event;
  sandbox: object | null;
  scriptId: string;
  sendToChrome(name: string, data?: unknown): void;
  setUnloadMap(
    key: string,
    callback: UserChromeUnloadCallback,
    context?: unknown,
  ): void;
  getDelUnloadMap(key: string, del?: boolean): UserChromeSharedUnloadEntry | undefined;
}

type UserChromeSharedContentHandler = (
  context: UserChromeSharedContentContext,
) => unknown;

interface UserChromeSharedContentHandlers {
  [eventName: string]: UserChromeSharedContentHandler | undefined;
  handleEvent?: UserChromeSharedContentHandler;
}

interface UserChromeSharedContentModule {
  contentHandlers?: UserChromeSharedContentHandlers;
  onContentMessage?(payload: UserChromeSharedContentMessagePayload): unknown;
}

declare const UC: {
  webExts: Map<string, Element>;
  sidebar: Map<string, Map<Window, Element>>;
};

/**
 * Compatibility API inherited from xiaoxiaoflood's userChrome.js loader.
 * Its public surface is frozen; do not add loader-specific members here.
 */
declare const _uc: _ucAPI;

/**
 * Preference API inherited from xiaoxiaoflood's userChrome.js loader.
 * Its public surface is frozen; do not add loader-specific members here.
 */
declare const xPref: xPreferenceAPI;

declare function setUnloadMap(
  key: string,
  callback: UserChromeUnloadCallback,
  context?: unknown,
): void;
