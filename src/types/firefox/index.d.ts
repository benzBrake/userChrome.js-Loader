/**
 * Firefox chrome/XPCOM declarations used by userChrome scripts.
 *
 * This is an intentionally focused subset of mozilla-central's XPIDL APIs.
 * Generate declarations from a matching Firefox checkout with XPIDL2DTS when
 * a complete interface surface is required.
 */

/// <reference path="./xul.d.ts" />
/// <reference path="./tab.d.ts" />

interface nsIID<T = nsISupports> {
  readonly __interfaceType?: T;
  equals(other: nsIID<unknown>): boolean;
}

interface nsISupports {
  QueryInterface<T extends nsISupports>(interfaceType: nsIID<T>): T;
}

type XPCOMInterfaceFor<T extends keyof ComponentsInterfaces> =
  ComponentsInterfaces[T] extends nsIID<infer Interface>
    ? Interface
    : nsISupports;

interface nsISimpleEnumerator<T = nsISupports> extends nsISupports {
  hasMoreElements(): boolean;
  getNext(): T;
}

interface nsIDirectoryEnumerator extends nsISimpleEnumerator<nsIFile> {
  close(): void;
}

interface nsIFile extends nsISupports {
  readonly NORMAL_FILE_TYPE: 0;
  readonly DIRECTORY_TYPE: 1;
  leafName: string;
  readonly displayName: string;
  /** `null` when this file is at the top of its volume. */
  readonly parent: nsIFile | null;
  readonly path: string;
  readonly target: string;
  readonly directoryEntries: nsIDirectoryEnumerator;
  permissions: number;
  permissionsOfLink: number;
  lastAccessedTime: number;
  lastAccessedTimeOfLink: number;
  lastModifiedTime: number;
  lastModifiedTimeOfLink: number;
  readonly creationTime: number;
  readonly creationTimeOfLink: number;
  fileSize: number;
  readonly fileSizeOfLink: number;
  readonly diskSpaceAvailable: number;
  readonly diskCapacity: number;
  persistentDescriptor: string;
  append(node: string): void;
  appendRelativePath(relativeFilePath: string): void;
  normalize(): void;
  create(type: 0 | 1, permissions: number, skipAncestors?: boolean): void;
  createUnique(type: 0 | 1, permissions: number): void;
  initWithPath(filePath: string): void;
  initWithFile(file: nsIFile): void;
  clone(): nsIFile;
  copyTo(newParentDir: nsIFile, newName: string): void;
  copyToFollowingLinks(newParentDir: nsIFile, newName: string): void;
  moveTo(newParentDir: nsIFile, newName: string): void;
  moveToFollowingLinks(newParentDir: nsIFile, newName: string): void;
  renameTo(newParentDir: nsIFile, newName: string): void;
  remove(recursive: boolean): void;
  exists(): boolean;
  isWritable(): boolean;
  isReadable(): boolean;
  isExecutable(): boolean;
  isHidden(): boolean;
  isDirectory(): boolean;
  isFile(): boolean;
  isSymlink(): boolean;
  isSpecial(): boolean;
  equals(file: nsIFile): boolean;
  contains(file: nsIFile): boolean;
  getRelativeDescriptor(fromFile: nsIFile): string;
  setRelativeDescriptor(fromFile: nsIFile, relativeDescriptor: string): void;
  getRelativePath(fromFile: nsIFile): string;
  setRelativePath(fromFile: nsIFile, relativePath: string): void;
  reveal(): void;
  launch(): void;
}

interface nsIURI extends nsISupports {
  spec: string;
  readonly displaySpec: string;
  readonly prePath: string;
  scheme: string;
  userPass: string;
  username: string;
  password: string;
  hostPort: string;
  host: string;
  port: number;
  pathQueryRef: string;
  filePath: string;
  query: string;
  ref: string;
  readonly hasRef: boolean;
  schemeIs(scheme: string): boolean;
  clone(): nsIURI;
  cloneIgnoringRef(): nsIURI;
  equals(other: nsIURI): boolean;
  equalsExceptRef(other: nsIURI): boolean;
  resolve(relativePath: string): string;
}

interface nsIProtocolHandler extends nsISupports {}

interface nsIFileProtocolHandler extends nsIProtocolHandler {
  getURLSpecFromActualFile(file: nsIFile): string;
  getFileFromURLSpec(spec: string): nsIFile;
}

interface nsIFileURL extends nsIURI {
  readonly file: nsIFile;
}

interface nsISubstitutingProtocolHandler extends nsIProtocolHandler {
  setSubstitution(root: string, baseURI: nsIURI | null): void;
  getSubstitution(root: string): nsIURI | null;
  hasSubstitution(root: string): boolean;
}

interface nsIResProtocolHandler extends nsISubstitutingProtocolHandler {}

interface nsIInputStream extends nsISupports {
  close(): void;
}

interface nsIChannel extends nsISupports {
  open(): nsIInputStream;
}

interface nsIScriptableInputStream extends nsISupports {
  init(inputStream: nsIInputStream): void;
  available(): number;
  read(count: number): string;
  close(): void;
}

interface nsIFileOutputStream extends nsISupports {
  init(file: nsIFile, ioFlags: number, permissions: number, behaviorFlags: number): void;
  write(data: string, count: number): number;
  close(): void;
}

interface nsIFilePicker extends nsISupports {
  modeOpen: number;
  modeSave: number;
  modeGetFolder: number;
  modeOpenMultiple: number;
  returnOK: number;
  returnCancel: number;
  filterAll: number;
  filterApps: number;
  filterText: number;
  filterImages: number;
  filterXML: number;
  filterHTML: number;
  filterXUL: number;
  file: nsIFile | null;
  files: nsISimpleEnumerator<nsIFile>;
  displayDirectory: nsIFile | null;
  defaultString: string;
  defaultExtension: string;
  init(parent: Window | null, title: string, mode: number): void;
  appendFilter(title: string, filter: string): void;
  appendFilters(filterMask: number): void;
  open(callback: (result: number) => void): void;
}

interface nsIClipboardHelper extends nsISupports {
  copyString(value: string, sourceDocument?: Document | null): void;
}

interface nsIAlertsService extends nsISupports {
  showAlertNotification(
    imageURL: string | null,
    title: string,
    text: string,
    textClickable?: boolean,
    cookie?: string,
    alertListener?: nsISupports | null,
    name?: string,
  ): void;
}

interface nsIAppStartup extends nsISupports {
  readonly eAttemptQuit: number;
  readonly eRestart: number;
  readonly eForceQuit: number;
  quit(mode: number): void;
}

interface nsIProcess extends nsISupports {
  init(executable: nsIFile): void;
  run(blocking: boolean, args: string[], count: number): void;
  runw(blocking: boolean, args: string[], count: number): void;
}

interface nsIConsoleService extends nsISupports {
  logStringMessage(message: string): void;
  logMessage(message: nsISupports): void;
}

interface nsIPromptService extends nsISupports {
  alert(parent: Window | null, title: string, text: string): void;
  confirm(parent: Window | null, title: string, text: string): boolean;
  prompt(
    parent: Window | null,
    title: string,
    text: string,
    value: { value: string },
    checkMsg?: string | null,
    checkValue?: { value: boolean } | null,
  ): boolean;
}

interface nsIWebProgress extends nsISupports {
  readonly isLoadingDocument: boolean;
  readonly DOMWindow: Window | null;
}

interface nsIWebProgressListener extends nsISupports {
  readonly STATE_START: number;
  readonly STATE_STOP: number;
  readonly STATE_IS_NETWORK: number;
  readonly STATE_IS_WINDOW: number;
  onStateChange(
    webProgress: nsIWebProgress | null,
    request: nsISupports | null,
    stateFlags: number,
    status: number,
  ): void;
  onLocationChange(
    webProgress: nsIWebProgress | null,
    request: nsISupports | null,
    location: nsIURI | null,
    flags: number,
  ): void;
}

interface nsIPrefBranch extends nsISupports {
  readonly PREF_INVALID: 0;
  readonly PREF_STRING: 32;
  readonly PREF_INT: 64;
  readonly PREF_BOOL: 128;
  readonly root: string;
  getPrefType(name: string): 0 | 32 | 64 | 128;
  getStringPref(name: string, fallback?: string): string;
  setStringPref(name: string, value: string): void;
  getCharPref(name: string, fallback?: string): string;
  setCharPref(name: string, value: string): void;
  getIntPref(name: string, fallback?: number): number;
  setIntPref(name: string, value: number): void;
  getFloatPref(name: string, fallback?: number): number;
  getBoolPref(name: string, fallback?: boolean): boolean;
  setBoolPref(name: string, value: boolean): void;
  getComplexValue<T extends nsISupports>(name: string, interfaceType: nsIID<T>): T;
  setComplexValue(name: string, interfaceType: nsIID<nsISupports>, value: nsISupports): void;
  clearUserPref(name: string): void;
  lockPref(name: string): void;
  unlockPref(name: string): void;
  deleteBranch(startingAt: string): void;
  getChildList(startingAt: string): string[];
  prefHasUserValue(name: string): boolean;
  prefHasDefaultValue(name: string): boolean;
  prefIsLocked(name: string): boolean;
  prefIsSanitized(name: string): boolean;
  getDefaultBranch(root?: string | null): nsIPrefBranch;
  addObserver(domain: string, observer: nsIObserver | nsIObserverCallback, holdWeak?: boolean): void;
  removeObserver(domain: string, observer: nsIObserver | nsIObserverCallback): void;
}

interface nsIIOService extends nsISupports {
  offline: boolean;
  readonly connectivity: boolean;
  newURI(spec: string | nsIURI, charset?: string | null, baseURI?: nsIURI | null): nsIURI;
  newFileURI(file: nsIFile): nsIURI;
  getProtocolHandler(scheme: string): nsIProtocolHandler;
  newChannelFromURI(
    uri: nsIURI,
    loadingNode: Node | null,
    loadingPrincipal: nsIPrincipal | null,
    triggeringPrincipal: nsIPrincipal | null,
    securityFlags: number,
    contentPolicyType: number,
  ): nsIChannel;
  extractScheme(url: string): string;
  allowPort(port: number, scheme: string): boolean;
}

interface nsIWindowMediator extends nsISupports {
  getMostRecentWindow(type?: string | null): Window | null;
  getEnumerator(type?: string | null): nsISimpleEnumerator<Window>;
}

interface nsIXULAppInfo extends nsISupports {
  readonly ID: string;
  readonly name: string;
  readonly version: string;
  readonly appBuildID: string;
  readonly platformVersion: string;
  readonly platformBuildID: string;
  readonly OS: string;
  readonly XPCOMABI: string;
  readonly widgetToolkit: string;
  readonly inSafeMode: boolean;
}

interface nsIObserver extends nsISupports {
  observe(subject: nsISupports | null, topic: string, data: string | null): void;
}

type nsIObserverCallback = (
  subject: nsISupports | null,
  topic: string,
  data: string | null,
) => void;

interface nsIObserverService extends nsISupports {
  addObserver(observer: nsIObserver | nsIObserverCallback, topic: string, ownsWeak?: boolean): void;
  removeObserver(observer: nsIObserver | nsIObserverCallback, topic: string): void;
  notifyObservers(subject: nsISupports | null, topic: string, data?: string | null): void;
  enumerateObservers(topic: string): nsISimpleEnumerator<nsIObserver>;
}

interface nsIProperties extends nsISupports {
  get<T extends nsISupports>(property: string, interfaceType: nsIID<T>): T;
  get(property: string, interfaceType?: nsIID): nsISupports;
  set(property: string, value: nsISupports): void;
  has(property: string): boolean;
  undefine(property: string): void;
}

interface nsIDirectoryService extends nsIProperties {
  init(): void;
  registerProvider(provider: nsIDirectoryServiceProvider): void;
  unregisterProvider(provider: nsIDirectoryServiceProvider): void;
}

interface nsIDirectoryServiceProvider extends nsISupports {
  getFile(property: string): nsIFile;
}

interface nsIScriptLoader extends nsISupports {
  loadSubScript(url: string, target?: object, charset?: string): unknown;
}

interface nsILocaleService extends nsISupports {
  readonly appLocaleAsBCP47: string;
  readonly appLocalesAsBCP47: string[];
}

interface nsISearchService extends nsISupports {
  init(): Promise<void>;
  getEngines(): Promise<readonly nsISearchEngine[]>;
  getDefault(): Promise<nsISearchEngine>;
  getEngineByName(name: string): nsISearchEngine | null;
}

interface nsISearchEngine extends nsISupports {
  readonly name: string;
  readonly description: string;
  getSubmission(searchTerms: string, responseType?: string): {
    uri: nsIURI;
    postData: nsISupports | null;
  } | null;
}

interface nsIETLDService extends nsISupports {
  getBaseDomainFromHost(host: string): string;
}

interface nsIUUID extends nsISupports {
  toString(): string;
}

interface nsIUUIDGenerator extends nsISupports {
  generateUUID(): nsIUUID;
}

interface nsIStyleSheetService extends nsISupports {
  loadAndRegisterSheet(uri: nsIURI, sheetType: number): void;
  unregisterSheet(uri: nsIURI, sheetType: number): void;
  sheetRegistered(uri: nsIURI, sheetType: number): boolean;
}

interface nsIScriptSecurityManager extends nsISupports {
  getSystemPrincipal(): nsIPrincipal;
}

interface nsIPrincipal extends nsISupports {}

interface nsIVersionComparator extends nsISupports {
  compare(versionA: string, versionB: string): number;
}

interface nsIPropertyBag2 extends nsISupports {
  getProperty(name: string): unknown;
}

interface Services {
  readonly prefs: nsIPrefBranch;
  readonly io: nsIIOService;
  readonly wm: nsIWindowMediator;
  readonly appinfo: nsIXULAppInfo;
  readonly obs: nsIObserverService;
  readonly dirsvc: nsIDirectoryService;
  readonly scriptloader: nsIScriptLoader;
  readonly locale: nsILocaleService;
  readonly eTLD: nsIETLDService;
  readonly uuid: nsIUUIDGenerator;
  readonly scriptSecurityManager: nsIScriptSecurityManager;
  readonly vc: nsIVersionComparator;
  readonly sysinfo: nsIPropertyBag2;
  readonly console: nsIConsoleService;
  readonly prompt: nsIPromptService;
  readonly startup: nsIAppStartup;
  readonly search: nsISearchService;
  [service: string]: unknown;
}

interface XPComFactory {
  createInstance<T extends nsISupports>(interfaceType: nsIID<T>): T;
  createInstance<T extends nsISupports = nsISupports>(interfaceType?: nsIID<T>): T;
  getService<T extends nsISupports>(interfaceType: nsIID<T>): T;
  getService<T extends nsISupports = nsISupports>(interfaceType?: nsIID<T>): T;
}

interface nsIFileIID extends nsIID<nsIFile> {
  readonly NORMAL_FILE_TYPE: 0;
  readonly DIRECTORY_TYPE: 1;
}

interface nsIPrefBranchIID extends nsIID<nsIPrefBranch> {
  readonly PREF_INVALID: 0;
  readonly PREF_STRING: 32;
  readonly PREF_INT: 64;
  readonly PREF_BOOL: 128;
}

interface nsIStyleSheetServiceIID extends nsIID<nsIStyleSheetService> {
  readonly AGENT_SHEET: number;
  readonly USER_SHEET: number;
  readonly AUTHOR_SHEET: number;
}

interface nsIFilePickerIID extends nsIID<nsIFilePicker> {
  readonly modeOpen: number;
  readonly modeSave: number;
  readonly modeGetFolder: number;
  readonly modeOpenMultiple: number;
  readonly returnOK: number;
  readonly returnCancel: number;
  readonly filterAll: number;
  readonly filterApps: number;
  readonly filterText: number;
  readonly filterImages: number;
  readonly filterXML: number;
  readonly filterHTML: number;
  readonly filterXUL: number;
}

interface nsIAppStartupIID extends nsIID<nsIAppStartup> {
  readonly eAttemptQuit: number;
  readonly eRestart: number;
  readonly eForceQuit: number;
}

interface nsIWebProgressListenerIID extends nsIID<nsIWebProgressListener> {
  readonly STATE_START: number;
  readonly STATE_STOP: number;
  readonly STATE_IS_NETWORK: number;
  readonly STATE_IS_WINDOW: number;
}

interface ComponentsInterfaces {
  [interfaceName: string]: nsIID<nsISupports> & object;
  nsIFile: nsIFileIID;
  nsIPrefBranch: nsIPrefBranchIID;
  nsIURI: nsIID<nsIURI>;
  nsIIOService: nsIID<nsIIOService>;
  nsIWindowMediator: nsIID<nsIWindowMediator>;
  nsIXULAppInfo: nsIID<nsIXULAppInfo>;
  nsIObserverService: nsIID<nsIObserverService>;
  nsIDirectoryService: nsIID<nsIDirectoryService>;
  nsIProperties: nsIID<nsIProperties>;
  nsIScriptLoader: nsIID<nsIScriptLoader>;
  mozIJSSubScriptLoader: nsIID<nsIScriptLoader>;
  nsIFileProtocolHandler: nsIID<nsIFileProtocolHandler>;
  nsIFileURL: nsIID<nsIFileURL>;
  nsIResProtocolHandler: nsIID<nsIResProtocolHandler>;
  nsISubstitutingProtocolHandler: nsIID<nsISubstitutingProtocolHandler>;
  nsISimpleEnumerator: nsIID<nsISimpleEnumerator>;
  nsIScriptableInputStream: nsIID<nsIScriptableInputStream>;
  nsIFileOutputStream: nsIID<nsIFileOutputStream>;
  nsIFilePicker: nsIFilePickerIID;
  nsIClipboardHelper: nsIID<nsIClipboardHelper>;
  nsIAlertsService: nsIID<nsIAlertsService>;
  nsIAppStartup: nsIAppStartupIID;
  nsIProcess: nsIID<nsIProcess>;
  nsIConsoleService: nsIID<nsIConsoleService>;
  nsIPromptService: nsIID<nsIPromptService>;
  nsIWebProgress: nsIID<nsIWebProgress>;
  nsIWebProgressListener: nsIWebProgressListenerIID;
  nsIStyleSheetService: nsIStyleSheetServiceIID;
  nsIComponentRegistrar: nsIID<nsIComponentRegistrar>;
  nsIPrincipal: nsIID<nsIPrincipal>;
}

interface nsIComponentRegistrar extends nsISupports {
  autoRegister(file: nsIFile): void;
}

interface ComponentsLike {
  readonly classes: Record<string, XPComFactory>;
  readonly interfaces: ComponentsInterfaces;
  readonly results: Record<string, number>;
  readonly utils: ComponentsUtils;
  readonly manager: nsISupports;
  readonly stack: ComponentsStackFrame | null;
  isSuccessCode(status: number): boolean;
  Constructor<T extends keyof ComponentsInterfaces>(
    contractID: string,
    interfaceName: T,
    initializer?: string,
  ): new (...args: unknown[]) => XPCOMInterfaceFor<T>;
}

interface ComponentsStackFrame {
  readonly filename: string;
  readonly name: string | null;
  readonly lineNumber: number;
  readonly caller: ComponentsStackFrame | null;
}

interface ComponentsUtils {
  Sandbox(principal: object, options?: Record<string, unknown>): object;
  evalInSandbox<T = unknown>(source: string, sandbox: object): T;
  exportFunction(functionObject: Function, targetScope: object, options?: { defineAs?: string }): Function;
  getGlobalForObject(object: object): object;
  import<T = Record<string, unknown>>(url: string, target?: object): T;
  nukeSandbox(sandbox: object): void;
  reportError(error: unknown): void;
  [member: string]: unknown;
}

interface ChromeUtilsLike {
  importESModule<T = Record<string, unknown>>(url: string): T;
  import<T = Record<string, unknown>>(url: string): T;
  defineLazyGetter(object: object, name: string, callback: () => unknown): void;
  defineESModuleGetters(object: object, modules: Record<string, string>): void;
  compileScript(source: string, options?: Record<string, unknown>): Promise<CompiledScript>;
  generateQI(interfaces: readonly nsIID[]): <T extends nsISupports>(
    interfaceType: nsIID<T>,
  ) => T;
  registerWindowActor(name: string, options?: WindowActorRegistrationOptions): void;
  unregisterWindowActor(name: string): void;
  getClassName(value: unknown): string;
  [member: string]: unknown;
}

interface CompiledScript {
  executeInGlobal(global: object): void;
}

interface WindowActorRegistrationOptions {
  allFrames?: boolean;
  includeChrome?: boolean;
  matches?: string[];
  remoteTypes?: string[];
  messageManagerGroups?: string[];
  parent?: WindowActorSidedOptions;
  child?: WindowActorChildOptions;
}

interface WindowActorSidedOptions {
  esModuleURI?: string;
}

interface WindowActorEventListenerOptions extends AddEventListenerOptions {
  createActor?: boolean;
}

interface WindowActorChildOptions extends WindowActorSidedOptions {
  events?: Record<string, WindowActorEventListenerOptions>;
  observers?: string[];
}

interface JSWindowActorMessage<T = unknown> {
  name: string;
  data: T;
}

declare class JSWindowActor {
  actorCreated?(): void;
  didDestroy?(): void;
  receiveMessage?(message: JSWindowActorMessage): unknown;
  sendAsyncMessage(name: string, data?: unknown, transfers?: unknown[]): void;
  sendQuery<T = unknown>(name: string, data?: unknown): Promise<T>;
}

declare class JSWindowActorParent extends JSWindowActor {
  readonly manager: unknown | null;
  readonly windowContext: unknown | null;
  readonly browsingContext: unknown | null;
}

declare class JSWindowActorChild extends JSWindowActor {
  readonly manager: unknown | null;
  readonly windowContext: unknown | null;
  readonly document: Document | null;
  readonly browsingContext: { readonly parent: unknown | null } | null;
  readonly docShell: unknown | null;
  readonly contentWindow: Window | null;
}

/** Firefox XUL elements exposed to browser-chrome user scripts. */
declare class XULElement extends Element {
  static parseXULToFragment(markup: string, ...args: string[]): DocumentFragment;
  static insertFTLIfNeeded(resource: string): Promise<void>;
}

declare class MozXULElement extends XULElement {
  static parseXULToFragment(markup: string, ...args: string[]): DocumentFragment;
  static insertFTLIfNeeded(resource: string): Promise<void>;
  initializeAttributeInheritance(): void;
}

interface BrowserElement extends XULElement {
  readonly currentURI: nsIURI;
  readonly contentTitle: string;
  readonly contentPrincipal: nsIPrincipal;
  readonly browsingContext: unknown;
  readonly contentWindow: Window;
  loadURI(uri: string | nsIURI, options?: Record<string, unknown>): void;
  reloadWithFlags(flags: number): void;
  stop(): void;
}

interface CustomizableUIWidget {
  readonly id: string;
  readonly type: string;
  forWindow(window: Window): { node: Element | null };
}

interface CustomizableUIListener {
  onWidgetAdded?(widgetId: string, area: string, position: number): void;
  onWidgetRemoved?(widgetId: string, area: string): void;
  onWidgetMoved?(widgetId: string, area: string, position: number): void;
  onWidgetBeforeDOMChange?(node: Element, nextNode: Element | null, container: Element, isRemoval: boolean): void;
}

interface CustomizableUIWidgetDescription {
  id: string;
  type?: "button" | "custom" | "view" | "toolbarbutton" | "toolbaritem";
  defaultArea?: string;
  label?: string;
  tooltiptext?: string;
  localized?: boolean;
  removable?: boolean;
  onBuild?(document: Document): Element;
  onCommand?(event: Event): void;
  onCreated?(node: Element): void;
  onDestroyed?(node: Element): void;
  [property: string]: unknown;
}

interface CustomizableUIStatic {
  readonly AREA_NAVBAR: string;
  readonly AREA_TABSTRIP: string;
  readonly AREA_ADDONS: string;
  readonly TYPE_TOOLBAR: string;
  createWidget(description: CustomizableUIWidgetDescription): void;
  destroyWidget(id: string): void;
  getWidget(id: string): CustomizableUIWidget | null;
  getPlacementOfWidget(id: string, includeDeadAreas?: boolean): { area: string; position: number } | null;
  addWidgetToArea(widgetId: string, area: string, position?: number): void;
  removeWidgetFromArea(widgetId: string): void;
  moveWidgetWithinArea(widgetId: string, position: number): void;
  removeWidget(widgetId: string): void;
  registerArea(area: string, properties?: Record<string, unknown>, placements?: string[]): void;
  registerToolbarNode(toolbar: Element): void;
  addListener(listener: CustomizableUIListener): void;
  removeListener(listener: CustomizableUIListener): void;
}

interface PanelMultiViewStatic {
  openPopup(panel: XULPopupElement, anchor: Element, options?: Record<string, unknown>): Promise<void>;
  getViewNode(document: Document, viewId: string): Element | null;
}

interface UrlbarInput extends XULElement {
  value: string;
  readonly inputField: HTMLInputElement;
  readonly textbox: Element;
  focus(): void;
  handleCommand(event?: Event, openWhere?: string, openParams?: Record<string, unknown>): void;
  setPageProxyState(state: string, updatePopupNotifications?: boolean): void;
}

interface BrowserWindowInitializer {
  delayedStartupFinished: boolean;
  _delayedStartup?(): void;
}

interface UnifiedExtensionsController {
  readonly panel: XULPopupElement;
  togglePanel(event?: Event): Promise<void>;
}

interface Document {
  getAnonymousElementByAttribute(
    element: Element,
    attributeName: string,
    attributeValue: string,
  ): Element | null;
}

interface Window {
  readonly gBrowser: TabBrowser;
  readonly gURLBar: UrlbarInput;
  readonly gBrowserInit: BrowserWindowInitializer;
  readonly gNavToolbox: Element;
  readonly gUnifiedExtensions: UnifiedExtensionsController;
  readonly CustomizableUI: CustomizableUIStatic;
  readonly PanelMultiView: PanelMultiViewStatic;
}

/** A browser chrome window, useful when a callback receives a generic Window. */
interface BrowserWindow extends Window {}

declare const Services: Services;
declare const Components: ComponentsLike;
declare const Cc: ComponentsLike["classes"];
declare const Ci: ComponentsLike["interfaces"];
declare const Cu: ComponentsLike["utils"];
declare const Cr: ComponentsLike["results"];
declare const ChromeUtils: ChromeUtilsLike;
declare const CustomizableUI: CustomizableUIStatic;
declare const PanelMultiView: PanelMultiViewStatic;
/** Available in Firefox browser chrome windows. */
declare const gBrowser: TabBrowser;
declare const gURLBar: UrlbarInput;
declare const gBrowserInit: BrowserWindowInitializer;
declare const gNavToolbox: Element;
declare const gUnifiedExtensions: UnifiedExtensionsController;
