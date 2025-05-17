
'use strict';

const { Services } = globalThis;
const { xPref } = ChromeUtils.importESModule("chrome://userchromejs/content/utils/xPref.sys.mjs");
const { AppConstants } = ChromeUtils.importESModule('resource://gre/modules/AppConstants.sys.mjs');
const { Management } = ChromeUtils.importESModule('resource://gre/modules/Extension.sys.mjs');

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

    get isFaked () {
        return true;
    },

    get isESM () {
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

try {
    function UserChrome_js () {
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

                Cu.exportFunction((key, func, context) => {
                    this.setUnloadMap(key, func, context);
                }, window, { defineAs: "setUnloadMap" });

                window.xPref = xPref;

                window.UC = UC;
                window._uc = _uc;

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