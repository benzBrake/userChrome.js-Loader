
'use strict';

const { Services } = globalThis;
const { xPref } = ChromeUtils.importESModule("chrome://userchromejs/content/xPref.sys.mjs");
const { AppConstants } = ChromeUtils.importESModule('resource://gre/modules/AppConstants.sys.mjs');
const { Management } = ChromeUtils.importESModule('resource://gre/modules/Extension.sys.mjs');
const FS = ChromeUtils.importESModule("chrome://userchromejs/content/fs.sys.mjs").FileSystem;

const UC = {
    webExts: new Map(),
    sidebar: new Map()
}

const _uc = {
    BROWSERCHROME: AppConstants.MOZ_APP_NAME == 'thunderbird' ? 'chrome://messenger/content/messenger.xhtml' : 'chrome://browser/content/browser.xhtml',
    BROWSERTYPE: AppConstants.MOZ_APP_NAME == 'thunderbird' ? 'mail:3pane' : 'navigator:browser',
    BROWSERNAME: AppConstants.MOZ_APP_NAME.charAt(0).toUpperCase() + AppConstants.MOZ_APP_NAME.slice(1),
    sss: Cc["@mozilla.org/content/style-sheet-service;1"].getService(Ci.nsIStyleSheetService),
    chromedir: Services.dirsvc.get('UChrm', Ci.nsIFile),
    scriptsDir: '',

    get isFaked() {
        return true;
    },

    windows: function (fun, onlyBrowsers = true) {
        let windows = Services.wm.getEnumerator(onlyBrowsers ? this.BROWSERTYPE : null);
        while (windows.hasMoreElements()) {
            let win = windows.getNext();
            if (!win._uc)
                continue;
            if (!onlyBrowsers) {
                let frames = win.docShell.getAllDocShellsInSubtree(Ci.nsIDocShellTreeItem.typeAll, Ci.nsIDocShell.ENUMERATE_FORWARDS);
                let res = frames.some(frame => {
                    let fWin = frame.domWindow;
                    let { document, location } = fWin;
                    if (fun(document, fWin, location))
                        return true;
                });
                if (res)
                    break;
            } else {
                let { document, location } = win;
                if (fun(document, win, location))
                    break;
            }
        }
    },

    createElement: function (doc, tag, atts, XUL = true) {
        let el = XUL ? doc.createXULElement(tag) : doc.createElement(tag);
        for (let att in atts) {
            el.setAttribute(att, atts[att]);
        }
        return el
    }
}

const loaderModuleLink = new (function () {
    let sessionRestored = false;
    let variant = null;
    let brandName = null;
    // .setup() is called once by boot.sys.mjs on startup
    this.setup = (ref, aVersion, aBrandName, aVariant, aScriptData) => {
        this.scripts = ref.scripts;
        this.styles = ref.styles;
        this.version = aVersion;
        this.getScriptMenu = (aDoc) => {
            return ref.generateScriptMenuItemsIfNeeded(aDoc);
        }
        brandName = aBrandName;
        variant = aVariant;
        this.scriptDataConstructor = aScriptData;
        delete this.setup;
        Object.freeze(this);
        return
    }
    Object.defineProperty(this, "variant", {
        get: () => {
            if (variant === null) {
                let is_tb = AppConstants.BROWSER_CHROME_URL.startsWith("chrome://messenger");
                variant = {
                    THUNDERBIRD: is_tb,
                    FIREFOX: !is_tb
                }
            }
            return variant
        }
    });
    Object.defineProperty(this, "brandName", {
        get: () => {
            if (brandName === null) {
                brandName = AppConstants.MOZ_APP_DISPLAYNAME_DO_NOT_USE
            }
            return brandName
        }
    });
    this.setSessionRestored = () => { sessionRestored = true };
    this.sessionRestored = () => sessionRestored;
    return this
})();

const SharedGlobal = {};
ChromeUtils.defineLazyGetter(SharedGlobal, "widgetCallbacks", () => { return new Map() });

const lazy = {
    startupPromises: new Set()
};

const _ucUtils = {
    get sharedGlobal() {
        return SharedGlobal
    },
    get fs() {
        return FS;
    },
    startupFinished() {
        if (loaderModuleLink.sessionRestored() || lazy.startupPromises === null) {
            return Promise.resolve();
        }
        if (lazy.startupPromises.size === 0) {
            const obs_topic = loaderModuleLink.variant.FIREFOX
                ? "sessionstore-windows-restored"
                : "browser-delayed-startup-finished";
            const startupObserver = () => {
                Services.obs.removeObserver(startupObserver, obs_topic);
                loaderModuleLink.setSessionRestored();
                for (let f of lazy.startupPromises) { f() }
                lazy.startupPromises.clear();
                lazy.startupPromises = null;
            }
            Services.obs.addObserver(startupObserver, obs_topic);
        }
        return new Promise(resolve => lazy.startupPromises.add(resolve))
    },
    createElement: _uc.createElement,
}

try {
    function UserChrome_js() {
        Services.obs.addObserver(this, 'domwindowopened', false);
    };

    UserChrome_js.prototype = {
        observe: function (aSubject, aTopic, aData) {
            aSubject.addEventListener('load', this, true);
        },

        messageListener: function (msg) {
            const browser = msg.target;
            const { addonId } = browser._contentPrincipal;

            browser.messageManager.removeMessageListener('Extension:ExtensionViewLoaded', this.messageListener);

            if (browser.ownerGlobal.location.href == 'chrome://extensions/content/dummy.xhtml') {
                UC.webExts.set(addonId, browser);
                Services.obs.notifyObservers(null, 'UCJS:WebExtLoaded', addonId);
            } else {
                let win = browser.ownerGlobal.windowRoot.ownerGlobal;
                UC.sidebar.get(addonId)?.set(win, browser) || UC.sidebar.set(addonId, new Map([[win, browser]]));
                Services.obs.notifyObservers(win, 'UCJS:SidebarLoaded', addonId);
            }
        },

        handleEvent: function (aEvent) {
            let document = aEvent.originalTarget;
            let window = document.defaultView;
            let { location } = window;
            if (location && location.protocol == 'chrome:') {
                const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
                const fph = ios.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
                const ds = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

                if (!this.sharedWindowOpened && location.href == 'chrome://extensions/content/dummy.xhtml') {
                    this.sharedWindowOpened = true;

                    Management.on('extension-browser-inserted', function (topic, browser) {
                        browser.messageManager.addMessageListener('Extension:ExtensionViewLoaded', this.messageListener.bind(this));
                    }.bind(this));
                    return;
                }

                window.xPref = xPref;

                window.UC = UC;
                window._uc = _uc;
                window._ucUtils = _ucUtils;

                if (window._gBrowser) // bug 1443849
                    window.gBrowser = window._gBrowser;

                let file = ds.get("UChrm", Ci.nsIFile);
                file.append('userChrome.js');
                let fileURL = fph
                    .getURLSpecFromActualFile(file) + "?" + file.lastModifiedTime;
                Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader)
                    .loadSubScript(fileURL, document.defaultView, 'UTF-8');
            }
        },
    };

    if (!Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULRuntime).inSafeMode)
        new UserChrome_js();

} catch (ex) { Cu.reportError(ex); };

try {
    pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);
} catch (e) { }