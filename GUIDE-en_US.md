# UserChromeJS Script Authoring Guide

> This guide is for developers writing scripts in the `UserChromeJS` directory. It helps you quickly understand the three script types (`.uc.js`, `.uc.mjs`, `.sys.mjs`), their authoring patterns, available UC APIs, and common practices.

For collaboration guidelines, pre-submission checklists, and reference lookup priorities, see [AGENTS.md](./AGENTS.md).

中文版请参阅 [GUIDE.md](./GUIDE.md)。

---

## Table of Contents

1. [Script Type Overview](#1-script-type-overview)
2. [Loader Lifecycle](#2-loader-lifecycle)
3. [Metadata Fields Quick Reference](#3-metadata-fields-quick-reference)
4. [`.uc.js` Script Authoring](#4-ucjs-script-authoring)
5. [`.uc.mjs` Script Authoring](#5-ucmjs-script-authoring)
6. [`.sys.mjs` Script Authoring](#6-sysmjs-script-authoring)
7. [UC API Reference](#7-uc-api-reference)
8. [Common Firefox API Imports](#8-common-firefox-api-imports)
9. [Coding Conventions](#9-coding-conventions)
10. [Common Patterns Quick Reference](#10-common-patterns-quick-reference)

---

## 1. Script Type Overview

| Type | Execution Mode | Window-Bound | Typical Use Case |
|------|---------------|-------------|-----------------|
| `.uc.js` | chrome-only | Per-window | Modifying browser UI, menus, toolbars, panels |
| `.uc.mjs` | Multiple (see below) | Depends on mode | Cross-window shared state, actor/content injection |
| `.sys.mjs` | background-module | None (imported once only) | Utility libraries, global observers, background services |

**Selection Guide:**

- Only modifying browser window UI → `.uc.js`
- Injecting logic into web page content → `.uc.mjs` (with `@actor` or `@content`)
- Writing utility functions for other scripts to import → `.sys.mjs` (with `@skip true`)
- Persistent background services → `.sys.mjs`

---

## 2. Loader Lifecycle

### Boot Chain

```
config.js (program directory, system principal)
  ├─ Disables signature verification
  ├─ Registers chrome://userchromejs/ → profile/chrome/
  ├─ Loads RemoveSignatureCheck.js
  └─ Imports boot.sys.mjs (ChromeUtils.importESModule)

userChrome.js (profile/chrome/)
  ├─ Listens for domwindowopened / chrome-document-global-created
  ├─ Injects global objects into each chrome window:
  │   ├─ window.UC       (webExts / sidebar Map)
  │   ├─ window.xPref    (lazy getter → xPref.sys.mjs)
  │   ├─ window._uc      (lazy getter → _uc.sys.mjs)
  │   └─ window.setUnloadMap / window.getUnloadMaps
  └─ Triggers boot.sys.mjs recursively

boot.sys.mjs (each chrome window)
  ├─ Scans script directories → parses metadata
  ├─ Registers actors (@actor / @content)
  ├─ Loads .sys.mjs background modules (ChromeUtils.importESModule, first time only)
  ├─ Loads .uc.mjs module scripts (importESModule + onWindowLoad callback)
  └─ Loads .uc.js scripts (loadSubScript → sandbox)
```

### Window Event Sequence

1. `domwindowopened` — Window created, global objects injected
2. Page `load` event — `boot.sys.mjs` is triggered
3. `runScripts()` — Matches window URL, loads scripts sequentially by directory order
4. Script `@startup` callback (if defined)
5. Window `unload` event — Script `@shutdown` callbacks + sandbox destruction

### `@startup` / `@shutdown`

```js
// ==UserScript==
// @startup    console.log("Startup:", script.filename, win.location.href)
// @shutdown   console.log("Shutdown:", script.filename, win.location.href)
// ==/UserScript==
```

- Code in `@startup` is executed via `Cu.evalInSandbox`, with parameters `(script, win)`
- `script` is the metadata object (containing `filename`, `description`, `onlyonce`, etc.)
- `win` is the current chrome window object
- `@shutdown` fires on window `unload`, also receiving `(script, win)`

### `@onlyonce`

Scripts marked `@onlyonce` execute only once in the first matching window. In subsequent windows:

- The script body is not re-executed
- However, `@startup` callbacks still fire for each window

---

## 3. Metadata Fields Quick Reference

All fields are written between `// ==UserScript==` and `// ==/UserScript==`.

### Common Fields

| Field | Example | Description |
|-------|---------|-------------|
| `@name` | `myScript.uc.js` | Script identifier; recommended to match filename |
| `@description` | `A brief description` | Single-line description; or use `@long-description` for multi-line |
| `@version` | `2026.06.28` | Version number, date format recommended |
| `@author` | `YourName` | Author |
| `@charset` | `UTF-8` | Character encoding |
| `@license` | `MIT License` | License |
| `@compatibility` | `Firefox 146` | Minimum verified version (not parsed by loader, for reference only) |
| `@homepageURL` | `https://github.com/...` | Homepage |
| `@downloadURL` | `https://raw.github.com/...` | Download URL |
| `@optionsURL` | `about:config?filter=...` | Settings page |
| `@note` | `2026.06.28 Fixed an issue` | Changelog; can appear multiple times |

### Window Matching

| Field | Example | Description |
|-------|---------|-------------|
| `@include` | `main` | Matches the main browser window (equivalent to `chrome://browser/content/browser.xhtml`) |
| `@include` | `chrome://messenger/content/messenger.xhtml` | Matches a specific window |
| `@exclude` | `chrome://global/content/commonDialog.xhtml` | Excludes a specific window |

- Without `@include`, only the main browser window is matched by default
- Wildcards and regex are supported

### Execution Control

| Field | Example | Description |
|-------|---------|-------------|
| `@skip` | `true` | Skip loading (for pure utility modules) |
| `@onlyonce` | *(no value, presence activates)* | Execute only once per session |
| `@async` | `true` | Asynchronous compilation and execution (`ChromeUtils.compileScript`) |
| `@sandbox` | `true` | Execute in sandbox (default behavior, usually no need to set explicitly) |
| `@backgroundmodule` | *(no value)* | Declares as a background module (default for `.sys.mjs`) |

### Actor / Content

| Field | Example | Description |
|-------|---------|-------------|
| `@actor` | `MyActor` | Register a JSWindowActor named `MyActor` |
| `@actor:matches` | `https://example.com/*` | Actor URL match list |
| `@actor:events` | `DOMContentLoaded, click` | Child process events to listen for |
| `@actor:allframes` | `true` | Whether the actor injects into all frames |
| `@actor:includeChrome` | `true` | Whether the actor includes chrome documents |
| `@content` | `true` | Enable shared content actor mode |
| `@content:matches` | `https://example.com/*` | Content URL match |
| `@content:events` | `DOMContentLoaded` | Content events to listen for (default: `DOMContentLoaded`) |
| `@content:allframes` | `false` | Whether content injects into all frames |
| `@content:sandbox` | `true` | Whether content runs in a sandbox |
| `@export` | `MyModule` | Exported module name (used for actor/content mode lookup) |

### Notes

- `@require` is **not parsed** by the loader — do not rely on it. For module dependencies, use standard ESM `import`.
- `@compatibility` has **no effect on loader behavior** — it is for manual reference only.

---

## 4. `.uc.js` Script Authoring

### Basic Template

```js
// ==UserScript==
// @name            myScript.uc.js
// @description     Modify browser toolbar with custom buttons
// @author          YourName
// @charset         UTF-8
// @compatibility   Firefox 146
// @version         2026.06.28
// @include         main
// @homepageURL     https://github.com/yourname/project
// @note            2026.06.28 Initial release
// ==/UserScript==
(function () {
    "use strict";

    // ---- Constants & Config ----
    const LOG_PREFIX = "[myScript]";

    // ---- Duplicate initialization guard (for dev/debug) ----
    if (window.MyScript) {
        window.MyScript.uninit();
        delete window.MyScript;
    }

    // ---- Script Body ----
    window.MyScript = {
        _btn: null,

        init() {
            this.createButton();
            setUnloadMap("__myScript", this.uninit, this);
        },

        createButton() {
            // Use _uc.createWidget to create toolbar buttons
            // Or manipulate DOM directly
        },

        uninit() {
            if (this._btn) {
                this._btn.remove();
                this._btn = null;
            }
            delete window.MyScript;
        },
    };

    // ---- Startup ----
    MyScript.init();
})();
```

### Available Global Objects

`.uc.js` runs in a chrome sandbox with `sandboxPrototype = window`. The following objects are directly available:

| Object | Source | Description |
|--------|--------|-------------|
| `window` / `document` / `location` | Sandbox prototype | Current chrome window |
| `Services` | `globalThis` | Firefox services (prefs, io, dirsvc, wm, etc.) |
| `Cc` | `Components.classes` | XPCOM component contracts |
| `Ci` | `Components.interfaces` | XPCOM interfaces |
| `Cu` | `Components.utils` | Chrome utilities |
| `Cr` | `Components.results` | NS_ERROR constants |
| `ChromeUtils` | Built-in | ESM imports, sandboxes, compilation, etc. |
| `UC` | Injected by `userChrome.js` | WebExtension tracking (`UC.webExts`, `UC.sidebar`) |
| `_uc` | Injected by `userChrome.js` (lazy) | Compatibility API (`windows`, `createElement`, `createWidget`) |
| `xPref` | Injected by `userChrome.js` (lazy) | Preference read/write |
| `setUnloadMap` | From `ucf.sys.mjs` | Register window unload cleanup callbacks |
| `gBrowser` | Browser window | Tab manager (only available with `@include main`) |

### Lazy-Loading Firefox Modules

```js
// Recommended: defineESModuleGetters
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
    AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
    CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
});

// Access via lazy.AddonManager
```

```js
// Direct import (for module scripts)
const { IOUtils } = ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs");
```

### Getting the Current Script's File Path

```js
const SCRIPT_FILENAME = Components.stack.filename.split("/").pop().split("?")[0];
```

### Window Unload Cleanup

```js
// Method 1: setUnloadMap (recommended, available in sandbox)
setUnloadMap("__myScript", function (key) {
    // Clean up resources
});

// Method 2: Direct unload listener
window.addEventListener("unload", function () {
    // Clean up resources
    window.removeEventListener("unload", arguments.callee, false);
}, false);
```

### Reference Scripts

- `AddonsPage_fx72.uc.js` — Full example of IIFE wrapping, lazy loading, idempotent protection, l10n, preference listeners, style registration

---

## 5. `.uc.mjs` Script Authoring

### Mode 1: Window Callback (`onWindowLoad`)

Suitable for scripts that need per-window initialization logic while leveraging the ESM module system.

```js
// ==UserScript==
// @name            myModule.uc.mjs
// @description     Per-window initialization module
// @author          YourName
// @version         2026.06.28
// @include         main
// @charset         UTF-8
// @compatibility   Firefox 146
// @note            2026.06.28 Initial release
// ==/UserScript==

// Module-level variables (shared across windows, since ESM is imported only once)
let initCount = 0;

// Export onWindowLoad; the loader calls it for each matching window
export function onWindowLoad(win) {
    initCount++;
    const doc = win.document;

    // Manipulate window DOM...
    // win._uc, win.xPref, win.UC and other global objects are available
}

// Export onContentMessage to receive content-side messages (optional)
// export function onContentMessage(payload) {
//     console.log("Message received:", payload.name, payload.data);
// }
```

**Execution flow:** The loader imports the module via `ChromeUtils.importESModule` → looks for the `onWindowLoad` export → calls `onWindowLoad(win)` for each matching window.

### Mode 2: Custom Actor (`@actor`)

Suitable for scripts that need precise control over JSWindowActor registration parameters.

```js
// ==UserScript==
// @name            myActor.uc.mjs
// @description     Custom Actor script
// @author          YourName
// @version         2026.06.28
// @include         main
// @actor           MyActor
// @actor:matches   https://example.com/*
// @actor:events    DOMContentLoaded
// @actor:allframes false
// @charset         UTF-8
// @compatibility   Firefox 146
// @note            2026.06.28 Initial release
// ==/UserScript==

// Parent (chrome side) — runs in the browser process
export class MyActorParent extends JSWindowActorParent {
    receiveMessage({ name, data }) {
        switch (name) {
            case "getContentInfo":
                console.log("Content info received:", data);
                return { status: "ok" };
        }
    }

    actorCreated() {
        console.log("Actor created");
    }

    didDestroy() {
        console.log("Actor destroyed");
    }
}

// Child (content side) — runs in the web content process
export class MyActorChild extends JSWindowActorChild {
    handleEvent(event) {
        if (event.type === "DOMContentLoaded") {
            const title = this.contentDocument.title;
            this.sendAsyncMessage("getContentInfo", { title });
        }
    }
}
```

**Execution flow:** The loader reads the `@actor` name → sets `parent.esModuleURI` and `child.esModuleURI` → calls `ChromeUtils.registerWindowActor` to register. After that, Parent class instances are created in `@include`-matched windows.

### Mode 3: Shared Content (`@content`)

Suitable for injecting logic into web page content areas, with multiple scripts sharing the same actor infrastructure.

```js
// ==UserScript==
// @name            myContent.uc.mjs
// @description     Content page injection script
// @author          YourName
// @version         2026.06.28
// @include         main
// @content         true
// @content:matches https://example.com/*
// @content:events  DOMContentLoaded
// @content:allframes false
// @export          MyContentModule
// @charset         UTF-8
// @compatibility   Firefox 146
// @note            2026.06.28 Initial release
// ==/UserScript==

export const MyContentModule = {
    // Content-side event handlers
    contentHandlers: {
        DOMContentLoaded(context) {
            // context.actor — JSWindowActorChild instance
            // context.contentDocument — Content document
            // context.contentWindow — Content window
            // context.sendToChrome(name, data) — Send message to chrome side
            const title = context.contentDocument.title;
            context.sendToChrome("pageInfo", { title });
        },
    },

    // Chrome-side message handler (optional)
    onContentMessage(payload) {
        // payload.name — Message name
        // payload.data — Message data
        // payload.browser — Associated <browser> element
        console.log("Content message received:", payload.name, payload.data);
    },
};
```

**Execution flow:** The loader registers a shared `UcSharedActor` → looks up the module export specified by `@export` → executes the corresponding event handler from `contentHandlers` on the content side when URLs match.

---

## 6. `.sys.mjs` Script Authoring

### Mode 1: Utility Module (`@skip true`)

A utility library for other scripts to `import` — **does not auto-execute**.

```js
// ==UserScript==
// @name            myUtils.sys.mjs
// @description     DOM utility function collection
// @author          YourName
// @version         1.0.0
// @skip            true
// @note            2026.06.28 Initial release
// ==/UserScript==
'use strict';

/**
 * Wait for a specific element to appear in the DOM
 * @param {Document} doc - Target document
 * @param {string} selector - CSS selector
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<Element>}
 */
export function waitForElement(doc, selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const el = doc.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const el = doc.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
    });
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}
```

**Import methods (from other scripts):**

```js
// In .uc.js (via chrome:// URL)
const { waitForElement } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/userChromeJS/myUtils.sys.mjs"
);

// In other .mjs (standard ESM import)
import { waitForElement, formatFileSize } from "chrome://userchromejs/content/userChromeJS/myUtils.sys.mjs";
```

### Mode 2: Background Module

`.sys.mjs` is treated as a background module by default — `ChromeUtils.importESModule` is called once on the first window trigger, and never repeated.

```js
// ==UserScript==
// @name            myObserver.sys.mjs
// @description     Global preference change observer
// @author          YourName
// @version         1.0.0
// @charset         UTF-8
// @note            2026.06.28 Initial release
// ==/UserScript==
'use strict';

// Note: Background modules do not have window/document/gBrowser
// But can access Services, ChromeUtils, Cc, Ci, Cu

const { Services } = globalThis;

const observer = {
    QueryInterface: ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]),

    observe(subject, topic, data) {
        if (topic === "nsPref:changed") {
            console.log("[myObserver] Preference changed:", data);
        }
    },
};

// Module-level code executes once on first import
Services.prefs.addObserver("", observer, true);

// Export for other scripts to use
export { observer };
```

### Reference Scripts

- `_uc.sys.mjs` — Compatibility API (`windows`, `createElement`, `createWidget`)
- `xPref.sys.mjs` — Preference wrapper (`get`, `set`, `lock`, `addListener`)
- `ucf.sys.mjs` — Window unload mapping (`initUloadMap`, `setUnloadMap`)
- `hookFunction.mjs` — Function hooks (before/after hook + unhook)

---

## 7. UC API Reference

### `UC` — WebExtension Tracking

Injected by `userChrome.js` into each chrome window.

```js
UC = {
    webExts: new Map(),   // addonId → browser element (WebExtension background page)
    sidebar: new Map(),   // addonId → Map<window, browser> (sidebar extensions)
}
```

**Observer Notifications:**
- `UCJS:WebExtLoaded` — WebExtension background loaded, data is the addonId
- `UCJS:SidebarLoaded` — Sidebar loaded, subject is the window, data is the addonId

### `_uc` — Compatibility API

Imported via lazy getter, sourced from `_uc.sys.mjs`.

| Property/Method | Description |
|----------------|-------------|
| `_uc.APPNAME` | Application name (`"firefox"` or `"thunderbird"`) |
| `_uc.BROWSERCHROME` | Main window URL (`"chrome://browser/content/browser.xhtml"`) |
| `_uc.BROWSERTYPE` | Window type (`"navigator:browser"` or `"mail:3pane"`) |
| `_uc.BROWSERNAME` | Display name (`"Firefox"` or `"Thunderbird"`) |
| `_uc.isFaked` | Always `true` (this loader's compatibility flag) |
| `_uc.isESM` | Always `true` |
| `_uc.sss` | `nsIStyleSheetService` instance (stylesheet service) |
| `_uc.chromedir` | `nsIFile` — UChrm directory |
| `_uc.windows(fun, onlyBrowsers)` | Iterate windows; `fun` receives `(doc, win, location)` |
| `_uc.createElement(doc, tag, attrs, XUL)` | Create element; `on*` attributes auto-register event listeners |
| `_uc.createWidget(desc)` | Create CustomizableUI toolbar button |

**`_uc.createWidget(desc)` parameters:**

```js
_uc.createWidget({
    id: "my-toolbar-button",           // Required, unique ID
    type: "toolbarbutton",              // "toolbarbutton" or "toolbaritem"
    label: "My Button",
    tooltip: "Click to perform action",
    image: "chrome://path/to/icon.svg", // or relative path
    area: CustomizableUI.AREA_NAVBAR,   // Default: navigation bar
    overflows: true,                     // Whether to allow overflow to menu
    class: "my-custom-class",
    callback: function (event, targetWin) {
        // Click callback
    },
});
```

**`_uc.createElement` example:**

```js
const btn = _uc.createElement(doc, "toolbarbutton", {
    id: "my-btn",
    label: "Click Me",
    tooltiptext: "Custom button",
    onclick: function (event) {
        console.log("Clicked");
    },
});
```

### `xPref` — Preference Read/Write

Imported via lazy getter, sourced from `xPref.sys.mjs`.

| Method | Description | Return Value |
|--------|-------------|-------------|
| `xPref.get(path, def, valueIfUndefined, setDefault)` | Read preference | `string` / `number` / `boolean` / `undefined` |
| `xPref.set(path, value, def)` | Write preference | The written value |
| `xPref.lock(path, value)` | Lock preference (lock + set default) | — |
| `xPref.unlock(path)` | Unlock preference | — |
| `xPref.clear(path)` | Clear user preference (`clearUserPref`) | — |
| `xPref.addListener(path, callback)` | Listen for preference changes | `{ prefPath, observer }` |
| `xPref.removeListener(obs)` | Remove listener | — |

**`addListener` usage:**

```js
// callback receives (newValue, prefPath)
const obs = xPref.addListener("browser.search.openintab", function (value, path) {
    console.log(path, "changed to", value);
});

// Remove listener
xPref.removeListener(obs);
```

**`get` type inference:**
- type 32 → `getStringPref` → `string`
- type 64 → `getIntPref` → `number`
- type 128 → `getBoolPref` → `boolean`
- type 0 (not registered) → `undefined`

### `setUnloadMap` — Window Unload Cleanup

Provided by `ucf.sys.mjs`, available in `.uc.js` sandboxes.

```js
// Register cleanup callback
setUnloadMap("myKey", function (key) {
    // this === context
    // Automatically called on window unload
    console.log("Cleanup:", key);
});

// Registering multiple times with the same key overwrites the previous one
setUnloadMap("myKey", function (key) {
    console.log("New cleanup callback");
});
```

### `hookFunction` — Function Hooks

From `hookFunction.mjs`, needs to be imported via `ChromeUtils.importESModule` in `.uc.js`.

```js
const { hookFunction } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/utils/hookFunction.mjs"
);

// Insert hooks before/after a target function
const unhook = hookFunction(
    targetObject,      // Object containing the function
    "methodName",      // Function name
    function onBefore(...args) {
        // Runs before the original function
        // Return value is passed to onAfter
        return null;
    },
    function onAfter(beforeResult, originalArgs, originalResult) {
        // Runs after the original function
        // Return value replaces the original function's return value
        return originalResult;
    }
);

// Remove hooks
unhook();
```

**Note:** The same function can only be hooked once. You can access the original function via `.originalFunction`.

---

## 8. Common Firefox API Imports

### Services (globally available, no import needed)

```js
// Services is accessible via globalThis in all script types
const { Services } = globalThis;

// Services sub-objects
Services.prefs       // Preference service
Services.io          // URI / IO service
Services.wm          // Window manager
Services.dirsvc      // Directory service
Services.obs         // Observer service
Services.scriptloader // Script loader
```

### Common ESM Import Paths

```js
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
    // Add-on management
    AddonManager: "resource://gre/modules/AddonManager.sys.mjs",

    // Toolbar customization
    CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",

    // Application constants
    AppConstants: "resource://gre/modules/AppConstants.sys.mjs",

    // File & IO
    IOUtils: "resource://gre/modules/IOUtils.sys.mjs",
    PathUtils: "resource://gre/modules/PathUtils.sys.mjs",

    // Async utilities
    setTimeout: "resource://gre/modules/Timer.sys.mjs",
    clearInterval: "resource://gre/modules/Timer.sys.mjs",
    clearTimeout: "resource://gre/modules/Timer.sys.mjs",

    // Console
    console: "resource://gre/modules/Console.sys.mjs",

    // Private browsing
    PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});
```

### Direct Import in `.sys.mjs`

```js
const { Services } = globalThis;
const { IOUtils, PathUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/IOUtils.sys.mjs"
);
```

### Cross-Script Import of userChromeJS Modules

```js
// Import utility modules
const { someUtil } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/userChromeJS/myUtils.sys.mjs"
);

// Import built-in utilities
const { hookFunction } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/utils/hookFunction.mjs"
);
```

---

## 9. Coding Conventions

### Idempotency & Cleanup

All scripts that may execute repeatedly must handle re-initialization:

```js
// 1. Check if already initialized
if (window.MyScript) {
    window.MyScript.uninit();
    delete window.MyScript;
}

// 2. Use setUnloadMap to register cleanup
setUnloadMap("__myScript", function () {
    // Clean up event listeners, styles, DOM nodes, etc.
});

// 3. Check if DOM element already exists before creating
if (doc.getElementById("my-custom-btn")) return;
```

### chrome/content Logic Separation

- **Chrome side:** Browser UI modifications → `.uc.js` or chrome logic in `.uc.mjs`
- **Content side:** Web page content operations → actor/content mode
- **Do not** directly manipulate `gBrowser.selectedBrowser.contentDocument` from chrome window logic

### Window Acquisition Fallback Chain

```js
// Prefer newer API, fall back to older API
const win = element.documentGlobal
    || element.ownerGlobal
    || element.ownerDocument?.defaultView;
```

### Script Discovery Directories

The loader scans subdirectories under `profile/chrome/` in the following order:

```
"" > "xul" > "TabMixPlus" > "withTabMixPlus" > "SubScript" > "UCJSFiles"
> "userCrome.js.0.8" > "userContent" > "userMenu" > "UserChromeJS"
```

Within the same directory, scripts execute in alphabetical order by filename.

### Script Disabling

Controlled via preferences (comma-separated filename lists):
- `userChrome.disable.directory` — Disable an entire directory
- `userChrome.disable.script` — Disable specific scripts

---

## 10. Common Patterns Quick Reference

### Creating a Toolbar Button

```js
_uc.createWidget({
    id: "my-custom-btn",
    type: "toolbarbutton",
    label: "My Button",
    tooltip: "Click to perform action",
    image: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='7' fill='blue'/></svg>",
    callback: function (event, win) {
        win.alert("Button clicked");
    },
});
```

### Registering a Global Stylesheet

```js
const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);

const css = `
    @namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
    #my-btn { background: red !important; }
`;
const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
sss.loadAndRegisterSheet(uri, sss.USER_SHEET);

// Cleanup
setUnloadMap("__myStyle", function () {
    sss.unregisterSheet(uri, sss.USER_SHEET);
});
```

### Iterating Browser Windows

```js
_uc.windows(function (doc, win, location) {
    // Execute for each browser window
    console.log(win.location.href);
    // Return true to stop iteration
    return false;
}, true); // true = browser windows only
```

### Preference Persistence

```js
// Read (set default if not exists, then return)
const myPref = xPref.get("extensions.myScript.enabled", false);

// Write
xPref.set("extensions.myScript.enabled", true);

// Listen for changes
const obs = xPref.addListener("extensions.myScript.enabled", function (value) {
    console.log("Preference changed:", value);
});

// Cleanup listener
setUnloadMap("__myPrefObserver", function () {
    xPref.removeListener(obs);
});
```

### Waiting for a DOM Element

```js
function waitForId(id, callback, win = window) {
    const el = win.document.getElementById(id);
    if (el) return callback(el);

    const observer = new MutationObserver(function () {
        const el = win.document.getElementById(id);
        if (el) {
            observer.disconnect();
            callback(el);
        }
    });
    observer.observe(win.document.documentElement, {
        childList: true, subtree: true,
    });
    setUnloadMap("__waitFor_" + id, () => observer.disconnect());
}
```

### Observer Registration & Cleanup

```js
const observer = {
    QueryInterface: ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]),
    observe(subject, topic, data) {
        if (topic === "browser-delayed-startup-finished") {
            // Browser startup complete
        }
    },
};

Services.obs.addObserver(observer, "browser-delayed-startup-finished");

setUnloadMap("__myObserver", function () {
    Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
});
```

### Opening Links / Files

```js
// Open URL
window.openTrustedLinkIn("https://example.com", "tab");

// Open about: page
window.openTrustedLinkIn("about:config", "tab");

// Reveal file in system explorer
const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
file.initWithPath("C:\\path\\to\\file");
if (file.exists()) file.reveal();

// Copy to clipboard
Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper).copyString("Text to copy");
```
