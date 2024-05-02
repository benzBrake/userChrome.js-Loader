// skip 1st line
/*
 2023/07/11 Removed Services.jsm, per Bug 1780695
 2022/06/07 remove osfile.jsm
 2021/08/05 fix for 92+ port Bug 1723723 - Switch JS consumers from getURLSpecFromFile to either getURLSpecFromActualFile or getURLSpecFromDir
 2019/12/11 01:30 fix 72 use "load" in config.js, working with Sub-Script/Overlay Loader v3.0.60mod
 2019-10-22 23:00
*/
lockPref("toolkit.telemetry.enabled", false);

try {

  let {
    classes: Cc,
    interfaces: Ci,
    manager: Cm,
    utils: Cu
  } = Components;

  //Cu.import('resource://gre/modules/osfile.jsm');

  let cmanifest = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('UChrm', Ci.nsIFile);
  cmanifest.append('utils');
  cmanifest.append('chrome.manifest');

  if (cmanifest.exists()) {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(cmanifest);
    // https://forum.mozilla-russia.org/viewtopic.php?pid=808453#p808453
    try {
      (jsval => {
        var dbg, gref, genv = func => {
          var sandbox = new Cu.Sandbox(g, { freshCompartment: true });
          Cc["@mozilla.org/jsdebugger;1"].createInstance(Ci.IJSDebugger).addClass(sandbox);
          (dbg = new sandbox.Debugger()).addDebuggee(g);
          gref = dbg.makeGlobalObjectReference(g);
          return (genv = func => func && gref.makeDebuggeeValue(func).environment)(func);
        }
        var g = Cu.getGlobalForObject(jsval), o = g.Object, { freeze } = o, disleg;

        var lexp = () => lockPref("extensions.experiments.enabled", true);
        var MRS = "MOZ_REQUIRE_SIGNING", AC = "AppConstants", uac = `resource://gre/modules/${AC}.`;

        if (o.isFrozen(o)) { // Fx 102.0b7+
          lexp(); disleg = true; genv();

          dbg.onEnterFrame = frame => {
            var { script } = frame;
            try { if (!script.url.startsWith(uac)) return; } catch { return; }
            dbg.onEnterFrame = undefined;

            if (script.isModule) { // ESM, Fx 108+
              var env = frame.environment;
              frame.onPop = () => env.setVariable(AC, gref.makeDebuggeeValue(freeze(
                o.assign(new o(), env.getVariable(AC).unsafeDereference(), { [MRS]: false })
              )));
            }
            else { // JSM
              var nsvo = frame.this.unsafeDereference();
              nsvo.Object = {
                freeze(ac) {
                  ac[MRS] = false;
                  delete nsvo.Object;
                  return freeze(ac);
                }
              };
            }
          }
        }
        else o.freeze = obj => {
          if (!Components.stack.caller.filename.startsWith(uac)) return freeze(obj);
          obj[MRS] = false;

          if ((disleg = "MOZ_ALLOW_ADDON_SIDELOAD" in obj)) lexp();
          else
            obj.MOZ_ALLOW_LEGACY_EXTENSIONS = true,
              lockPref("extensions.legacy.enabled", true);

          return (o.freeze = freeze)(obj);
        }
        lockPref("xpinstall.signatures.required", false);
        lockPref("extensions.langpacks.signatures.required", false);

        var useDbg = true, xpii = "resource://gre/modules/addons/XPIInstall.";
        if (Ci.nsINativeFileWatcherService) { // Fx < 100
          jsval = Cu.import(xpii + "jsm", {});
          var shouldVerify = jsval.shouldVerifySignedState;
          if (shouldVerify.length == 1)
            useDbg = false,
              jsval.shouldVerifySignedState = addon => !addon.id && shouldVerify(addon);
        }
        if (useDbg) { // Fx 99+
          try { var exp = ChromeUtils.importESModule(xpii + "sys.mjs"); }
          catch { exp = g.ChromeUtils.import(xpii + "jsm"); }
          jsval = o.assign({}, exp);

          var env = genv(jsval.XPIInstall.installTemporaryAddon);
          var ref = name => { try { return env.find(name).getVariable(name).unsafeDereference(); } catch { } }
          jsval.XPIDatabase = (ref("XPIExports") || ref("lazy") || {}).XPIDatabase || ref("XPIDatabase");

          var proto = ref("Package").prototype;
          var verify = proto.verifySignedState;
          proto.verifySignedState = function (id) {
            return id ? { cert: null, signedState: undefined } : verify.apply(this, arguments);
          }
          dbg.removeAllDebuggees();
        }
        if (disleg) jsval.XPIDatabase.isDisabledLegacy = () => false;
      })(
        "permitCPOWsInScope" in Cu ? Cu.import("resource://gre/modules/WebRequestCommon.jsm", {}) : Cu
      );
    }
    catch (ex) { Cu.reportError(ex); }
    parseInt(Services.appinfo.version) < 125 ?
      Cu.import('chrome://userchromejs/content/BootstrapLoader.jsm') :
      ChromeUtils.importESModule("chrome://userchromejs/content/BootstrapLoader.sys.mjs");
  }
} catch (ex) { Cu.reportError(ex); }

try {
  if (!Services)
    Services = Cu.import('resource://gre/modules/Services.jsm', {}).Services;
} catch (ex) { }

try {
  const { AppConstants } = parseInt(Services.appinfo.version) < 108 ? ChromeUtils.import('resource://gre/modules/AppConstants.jsm') : ChromeUtils.importESModule("resource://gre/modules/AppConstants.sys.mjs");

  let UC = {
    webExts: new Map(),
    sidebar: new Map()
  }

  let _uc = {
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

  function UserChrome_js() {
    Services.obs.addObserver(this, 'domwindowopened', false);
  };

  UserChrome_js.prototype = {
    observe: function (aSubject, aTopic, aData) {
      aSubject.addEventListener('load', this, true);
    },

    handleEvent: function (aEvent) {
      let document = aEvent.originalTarget;
      let window = document.defaultView;
      let { location, Object, console } = window;
      if (location && location.protocol == 'chrome:') {
        const ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        const fph = ios.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
        const ds = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

        const { xPref } = parseInt(Services.appinfo.version) >= 115 ? ChromeUtils.importESModule("chrome://userchromejs/content/xPref.sys.mjs") : Cu.import("chrome://userchromejs/content/xPref.jsm");
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