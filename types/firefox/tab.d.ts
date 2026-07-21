/** Firefox browser tab and tab-strip declarations. */

interface BrowserTab extends XULElement {
  readonly linkedBrowser: BrowserElement;
  readonly container: TabContainer;
  label: string;
  image: string;
  pinned: boolean;
  selected: boolean;
  multiselected: boolean;
  closing: boolean;
  linkedPanel: string;
}

interface TabContainer extends XULElement {
  readonly allTabs: readonly BrowserTab[];
  selectedItem: BrowserTab | null;
  arrowScrollbox?: Element;
}

interface TabBrowser extends XULElement {
  selectedTab: BrowserTab;
  selectedBrowser: BrowserElement;
  readonly selectedTabs: readonly BrowserTab[];
  readonly tabs: readonly BrowserTab[];
  readonly tabContainer: TabContainer;
  readonly mTabContainer: TabContainer;
  readonly tabpanels: Element;
  readonly mPanelContainer: Element;
  readonly currentURI: nsIURI;
  addTab(uri?: string, options?: Record<string, unknown>): BrowserTab;
  addTrustedTab(uri: string, options?: Record<string, unknown>): BrowserTab;
  getBrowserForTab(tab: BrowserTab): BrowserElement;
  getTabForBrowser(browser: BrowserElement): BrowserTab | null;
  getIcon(tab: BrowserTab): string | null;
  getFindBar(tab?: BrowserTab): Promise<Element>;
  getPanel(browser: BrowserElement): Element | null;
  loadURI(uri: string | nsIURI, options?: Record<string, unknown>): void;
  reload(): void;
  reloadTab(tab: BrowserTab): void;
  removeTab(tab: BrowserTab, options?: Record<string, unknown>): void;
  removeTabs(tabs: readonly BrowserTab[], options?: Record<string, unknown>): void;
  removeAllTabsBut(tab: BrowserTab): void;
  removeTabsToTheEndFrom(tab: BrowserTab): void;
  removeTabsToTheStartFrom(tab: BrowserTab): void;
  removeCurrentTab(options?: Record<string, unknown>): void;
  pinTab(tab: BrowserTab): void;
  unpinTab(tab: BrowserTab): void;
  pinMultiSelectedTabs(): void;
  unpinMultiSelectedTabs(): void;
  undoRemoveTab(index?: number): BrowserTab | null;
}
