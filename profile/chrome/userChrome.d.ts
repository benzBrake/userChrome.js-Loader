/// <reference path="../../types/firefox/index.d.ts" />

/** Execution strategy selected from a script's metadata block. */
type UserChromeExecutionMode =
  | "background-module"
  | "chrome-only"
  | "custom-actor"
  | "shared-actor";

/** Per-event options collected from `@actor:events` or `@content:events`. */
type UserChromeActorEvents = Record<string, WindowActorEventListenerOptions>;

/** Metadata collected for a script declaring `@actor`. */
interface UserChromeActorParameters {
  matches?: string[];
  kind?: string;
  includeChrome?: boolean;
  messageManagerGroups?: string[];
  events?: UserChromeActorEvents;
  allFrames?: boolean;
  parent?: WindowActorSidedOptions;
  child?: WindowActorChildOptions;
}

/** Metadata collected for a script declaring `@content true`. */
interface UserChromeContentParameters {
  matches?: string[];
  messageManagerGroups?: string[];
  events?: UserChromeActorEvents;
  allFrames?: boolean;
  sandbox?: boolean;
}

/** The loader's normalized representation of a `.uc.js`, `.uc.mjs`, or overlay. */
interface UserChromeScript {
  filename: string;
  file: nsIFile;
  url: string;
  dir: string;
  isActor: boolean;
  charset: string;
  description: string;
  async: boolean;
  sandbox: boolean;
  skip: boolean;
  backgroundMode: boolean;
  exportedModule: string;
  icon: string;
  iconURL: string;
  note: string;
  notes: string[];
  regex: RegExp;
  onlyonce: boolean;
  homepageURL: string;
  downloadURL: string;
  optionsURL: string;
  startup: string;
  shutdown: string;
  license: string;
  longDescription: string;
  fullDescription: string;
  actor?: string;
  actorParams?: UserChromeActorParameters;
  isContentScript?: boolean;
  contentParams?: UserChromeContentParameters | null;
  executionMode?: UserChromeExecutionMode;
  moduleURI?: string;
  scriptId?: string;
  isRunning?: boolean;
  chromedir?: string;
  LastModifiedTime?: number | string;
  ucjs?: boolean;
  xul?: string;
}

interface UserChromeDirectoryState {
  name: string[];
  UCJS: boolean[];
  enable: boolean[];
}

/** A preference-backed set whose keys are disabled script or directory names. */
interface UserChromeDisabledState {
  [name: string]: boolean | undefined;
}

interface UserChromeOverlayObserver {
  observe(subject: unknown, topic: string, data: unknown): void;
}

type UserChromeOverlayObserverInput =
  | UserChromeOverlayObserver
  | ((subject: unknown, topic: string, data: unknown) => void);

type UserChromeOverlayRequest = [
  url: string,
  observer?: UserChromeOverlayObserverInput | null,
  document?: Document,
];

interface UserChromeModuleResolution {
  moduleNS: Record<string, unknown>;
  exportedModule: unknown | null;
}

/** Runtime API installed by `userChrome.js` in every supported chrome window. */
interface UserChromeLoader {
  USE_0_63_FOLDER: boolean;
  UCJS: string[];
  arrSubdir: string[];
  FORCESORTSCRIPT: boolean;
  ALWAYSEXECUTE: string[];
  INFO: boolean;
  BROWSERCHROME: string;
  EXCLUDE_CHROMEHIDDEN: boolean;
  REPLACECACHE: boolean;
  readonly hackVersion: string;
  scripts: UserChromeScript[];
  overlays: UserChromeScript[];
  directory: UserChromeDirectoryState;
  dirDisable: UserChromeDisabledState;
  scriptDisable: UserChromeDisabledState;
  getScriptsDone?: boolean;
  sb?: object;
  L10nRegistry?: unknown;
  shutdown: boolean;
  overlayWait: number;
  overlayUrl: UserChromeOverlayRequest[];
  getScripts(): void;
  getLastModifiedTime(scriptFile: nsIFile): number | string;
  ensureScriptMetadata(script: UserChromeScript): UserChromeScript;
  runBackgroundModule(script: UserChromeScript): boolean;
  ensureSharedActorRegistration(): void;
  registerScriptActor(script: UserChromeScript): void;
  resolveModuleNamespace(script: UserChromeScript): UserChromeModuleResolution;
  attachSharedChromeBridge(
    script: UserChromeScript,
    win: Window,
    moduleNS: Record<string, unknown>,
    exportedModule: unknown | null,
  ): void;
  runModuleScript(script: UserChromeScript, win: Window, targetWin: object): boolean;
  registerScriptShutdown(script: UserChromeScript, win: Window, target: object): void;
  loadOverlay(
    url: string,
    observer?: UserChromeOverlayObserverInput | null,
    document?: Document,
  ): void;
  load(): number | undefined;
  runOverlays(document: Document): void;
  runScripts(document: Document): void;
  debug(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface Window {
  userChrome_js: UserChromeLoader;
}

/** Alias exposed by Firefox's chrome global for `window.userChrome_js`. */
declare var userChrome_js: UserChromeLoader;
