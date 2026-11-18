/// <reference path="../../types/firefox/index.d.ts" />

/** Execution strategy selected from a script's metadata block. */
type UserChromeExecutionMode =
  | "background-module"
  | "chrome-only"
  | "custom-actor"
  | "shared-actor";

/** Per-event options collected from `@actor:events` or `@content:events`. */
type UserChromeActorEvents = Record<string, WindowActorEventListenerOptions>;

/** Literal fallback text with optional BCP 47 translations. */
type UserChromeOptionText = string | { default: string; [locale: string]: string };

interface UserChromeOptionBase {
  key: string;
  label?: UserChromeOptionText;
  description?: UserChromeOptionText;
  group?: UserChromeOptionText;
}

interface UserChromePathOptions {
  base: "UChrm" | "ProfD" | "script";
  format: "relative" | "absolute" | "prefer-relative";
}

interface UserChromeFilePickerOptions {
  mode?: "open" | "folder";
  filters?: { label?: UserChromeOptionText; pattern: string }[];
}

/** One JSON object per @pref line; complex nsIFile always stores absolute paths. */
type UserChromeOption = UserChromeOptionBase & (
  | { type: "bool"; fallback?: boolean }
  | { type: "number"; fallback?: number; min?: number; max?: number }
  | { type: "string"; fallback?: string; path?: UserChromePathOptions;
      control?: "filepicker"; picker?: UserChromeFilePickerOptions }
  | { type: "enum"; valueType: "string"; fallback?: string;
      choices: { value: string; label?: UserChromeOptionText }[] }
  | { type: "enum"; valueType: "number"; fallback?: number;
      choices: { value: number; label?: UserChromeOptionText }[] }
  | { type: "enum"; valueType: "bool"; fallback?: boolean;
      choices: { value: boolean; label?: UserChromeOptionText }[] }
  | { type: "complex"; interface: "nsIFile"; fallback?: string;
      path?: Omit<UserChromePathOptions, "format"> & { format: "absolute" };
      control?: "filepicker"; picker?: UserChromeFilePickerOptions }
  | { type: "complex"; interface: "nsIPrefLocalizedString"; fallback?: string }
);

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
  relativePath?: string;
  scriptId?: string;
  name?: string;
  version?: string;
  author?: string;
  id?: string;
  updateURL?: string;
  reviewURL?: string;
  isEnabled?: boolean;
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
  options: readonly UserChromeOption[];
  optionErrors: readonly { line: number; code: string }[];
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
  readFile(file: nsIFile, metaOnly?: boolean): string;
  getScriptData(file: nsIFile): UserChromeScript;
  getScriptWindows(): Window[];
  refreshDisabledState(): UserChromeDisabledState;
  isScriptEnabled(script: UserChromeScript): boolean;
  isLifecycleManaged(script: UserChromeScript): boolean;
  isHotReloadable(script: UserChromeScript): boolean;
  loadScript(script: UserChromeScript, win?: Window): boolean;
  unloadScript(script: UserChromeScript): boolean;
  reloadScript(script: UserChromeScript): UserChromeScript | null;
  setScriptEnabled(script: UserChromeScript, enabled: boolean): boolean;
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
