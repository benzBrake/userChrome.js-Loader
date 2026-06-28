# userChromeJS 脚本编写指南

> 本指南面向 `UserChromeJS` 目录下的脚本开发者，帮助快速理解三种脚本类型（`.uc.js`、`.uc.mjs`、`.sys.mjs`）的编写模式、可用的 UC API 和常见实践。

协作规范、提交前核对清单和资料查询优先级请参阅 [AGENTS.md](./AGENTS.md)。

---

## 目录

1. [脚本类型概览](#1-脚本类型概览)
2. [Loader 生命周期](#2-loader-生命周期)
3. [元数据字段速查](#3-元数据字段速查)
4. [`.uc.js` 脚本编写](#4-ucjs-脚本编写)
5. [`.uc.mjs` 脚本编写](#5-ucmjs-脚本编写)
6. [`.sys.mjs` 脚本编写](#6-sysmjs-脚本编写)
7. [UC API 参考](#7-uc-api-参考)
8. [Firefox API 常用导入](#8-firefox-api-常用导入)
9. [编码规范要点](#9-编码规范要点)
10. [常见模式速查](#10-常见模式速查)

---

## 1. 脚本类型概览

| 类型 | 执行模式 | 窗口绑定 | 典型场景 |
|------|---------|---------|---------|
| `.uc.js` | chrome-only | 每窗口 | 修改浏览器 UI、菜单、工具栏、面板 |
| `.uc.mjs` | 多种（见下文） | 视模式而定 | 需要跨窗口共享状态、actor/content 注入 |
| `.sys.mjs` | background-module | 无（仅 import 一次） | 工具库、全局 observer、后台服务 |

**选择建议：**

- 只改浏览器窗口 UI → `.uc.js`
- 需要把逻辑注入到网页内容 → `.uc.mjs`（带 `@actor` 或 `@content`）
- 写工具函数供其他脚本 import → `.sys.mjs`（带 `@skip true`）
- 需要全局常驻的后台服务 → `.sys.mjs`

---

## 2. Loader 生命周期

### 引导链

```
config.js (程序目录, system principal)
  ├─ 禁用签名验证
  ├─ 注册 chrome://userchromejs/ → profile/chrome/
  ├─ 加载 RemoveSignatureCheck.js
  └─ 导入 boot.sys.mjs (ChromeUtils.importESModule)

userChrome.js (profile/chrome/)
  ├─ 监听 domwindowopened / chrome-document-global-created
  ├─ 注入全局对象到每个 chrome 窗口:
  │   ├─ window.UC       (webExts / sidebar Map)
  │   ├─ window.xPref    (lazy getter → xPref.sys.mjs)
  │   ├─ window._uc      (lazy getter → _uc.sys.mjs)
  │   └─ window.setUnloadMap / window.getUnloadMaps
  └─ 递归触发 boot.sys.mjs

boot.sys.mjs (每个 chrome 窗口)
  ├─ 扫描脚本目录 → 解析元数据
  ├─ 注册 actor (@actor / @content)
  ├─ 加载 .sys.mjs 后台模块 (ChromeUtils.importESModule, 仅首次)
  ├─ 加载 .uc.mjs 模块脚本 (importESModule + onWindowLoad 回调)
  └─ 加载 .uc.js 脚本 (loadSubScript → sandbox)
```

### 窗口事件顺序

1. `domwindowopened` — 窗口创建，全局对象注入
2. 页面 `load` 事件 — `boot.sys.mjs` 被触发
3. `runScripts()` — 匹配窗口 URL，按目录顺序逐个加载脚本
4. 脚本 `@startup` 回调（如有）
5. 窗口 `unload` 事件 — 脚本 `@shutdown` 回调 + sandbox 销毁

### `@startup` / `@shutdown`

```js
// ==UserScript==
// @startup    console.log("启动:", script.filename, win.location.href)
// @shutdown   console.log("卸载:", script.filename, win.location.href)
// ==/UserScript==
```

- `@startup` 中的代码通过 `Cu.evalInSandbox` 执行，参数为 `(script, win)`
- `script` 是元数据对象（包含 `filename`、`description`、`onlyonce` 等）
- `win` 是当前 chrome 窗口对象
- `@shutdown` 在窗口 `unload` 时触发，同样接收 `(script, win)`

### `@onlyonce`

标记为 `@onlyonce` 的脚本只在第一个匹配窗口执行一次。后续窗口中：
- 脚本体不会重新执行
- 但 `@startup` 回调仍会在每个窗口触发

---

## 3. 元数据字段速查

所有字段写在 `// ==UserScript==` 和 `// ==/UserScript==` 之间。

### 通用字段

| 字段 | 示例 | 说明 |
|------|------|------|
| `@name` | `myScript.uc.js` | 脚本标识名，推荐与文件名一致 |
| `@description` | `一句话简介` | 单行描述；也可用 `@long-description` 多行 |
| `@version` | `2026.06.28` | 版本号，推荐日期格式 |
| `@author` | `YourName` | 作者 |
| `@charset` | `UTF-8` | 字符编码 |
| `@license` | `MIT License` | 许可证 |
| `@compatibility` | `Firefox 146` | 实际验证过的最低版本（loader 不解析，仅人工参考） |
| `@homepageURL` | `https://github.com/...` | 主页 |
| `@downloadURL` | `https://raw.github.com/...` | 下载地址 |
| `@optionsURL` | `about:config?filter=...` | 设置页面 |
| `@note` | `2026.06.28 修复某问题` | 变更记录，可多次出现 |

### 窗口匹配

| 字段 | 示例 | 说明 |
|------|------|------|
| `@include` | `main` | 匹配主浏览器窗口（等价于 `chrome://browser/content/browser.xhtml`） |
| `@include` | `chrome://messenger/content/messenger.xhtml` | 匹配指定窗口 |
| `@exclude` | `chrome://global/content/commonDialog.xhtml` | 排除指定窗口 |

- 无 `@include` 时默认仅匹配主浏览器窗口
- 支持通配符和正则

### 执行控制

| 字段 | 示例 | 说明 |
|------|------|------|
| `@skip` | `true` | 跳过加载（用于纯工具模块） |
| `@onlyonce` | *(无值，存在即生效)* | 整个会话只执行一次 |
| `@async` | `true` | 异步编译执行（`ChromeUtils.compileScript`） |
| `@sandbox` | `true` | 在沙箱中执行（默认行为，通常无需显式设置） |
| `@backgroundmodule` | *(无值)* | 声明为后台模块（`.sys.mjs` 默认生效） |

### Actor / Content

| 字段 | 示例 | 说明 |
|------|------|------|
| `@actor` | `MyActor` | 注册名为 `MyActor` 的 JSWindowActor |
| `@actor:matches` | `https://example.com/*` | Actor 匹配 URL 列表 |
| `@actor:events` | `DOMContentLoaded, click` | Actor 子进程监听的事件 |
| `@actor:allframes` | `true` | Actor 是否注入所有 frame |
| `@actor:includeChrome` | `true` | Actor 是否包含 chrome 文档 |
| `@content` | `true` | 启用共享 content actor 模式 |
| `@content:matches` | `https://example.com/*` | Content 匹配 URL |
| `@content:events` | `DOMContentLoaded` | Content 监听事件（默认 `DOMContentLoaded`） |
| `@content:allframes` | `false` | Content 是否注入所有 frame |
| `@content:sandbox` | `true` | Content 是否在沙箱中运行 |
| `@export` | `MyModule` | 导出的模块名（用于 actor/content 模式查找） |

### 注意

- `@require` **不被 loader 解析**，不要依赖它。模块依赖请使用标准 ESM `import`。
- `@compatibility` **不影响 loader 行为**，仅作为人工维护参考。

---

## 4. `.uc.js` 脚本编写

### 基本模板

```js
// ==UserScript==
// @name            myScript.uc.js
// @description     修改浏览器工具栏，添加自定义按钮
// @author          YourName
// @charset         UTF-8
// @compatibility   Firefox 146
// @version         2026.06.28
// @include         main
// @homepageURL     https://github.com/yourname/project
// @note            2026.06.28 初始版本
// ==/UserScript==
(function () {
    "use strict";

    // ---- 常量与配置 ----
    const LOG_PREFIX = "[myScript]";

    // ---- 防重复初始化（开发调试用） ----
    if (window.MyScript) {
        window.MyScript.uninit();
        delete window.MyScript;
    }

    // ---- 脚本主体 ----
    window.MyScript = {
        _btn: null,

        init() {
            this.createButton();
            setUnloadMap("__myScript", this.uninit, this);
        },

        createButton() {
            // 使用 _uc.createWidget 创建工具栏按钮
            // 或直接操作 DOM
        },

        uninit() {
            if (this._btn) {
                this._btn.remove();
                this._btn = null;
            }
            delete window.MyScript;
        },
    };

    // ---- 启动 ----
    MyScript.init();
})();
```

### 可用的全局对象

`.uc.js` 在 chrome 沙箱中运行，`sandboxPrototype = window`，以下对象直接可用：

| 对象 | 来源 | 说明 |
|------|------|------|
| `window` / `document` / `location` | 沙箱原型 | 当前 chrome 窗口 |
| `Services` | `globalThis` | Firefox 服务（prefs、io、dirsvc、wm 等） |
| `Cc` | `Components.classes` | XPCOM 组件合约 |
| `Ci` | `Components.interfaces` | XPCOM 接口 |
| `Cu` | `Components.utils` | Chrome 工具 |
| `Cr` | `Components.results` | NS_ERROR 常量 |
| `ChromeUtils` | 内置 | ESM 导入、沙箱、编译等 |
| `UC` | `userChrome.js` 注入 | WebExtension 追踪（`UC.webExts`、`UC.sidebar`） |
| `_uc` | `userChrome.js` 注入（lazy） | 兼容 API（`windows`、`createElement`、`createWidget`） |
| `xPref` | `userChrome.js` 注入（lazy） | 偏好读写 |
| `setUnloadMap` | `ucf.sys.mjs` | 注册窗口卸载清理回调 |
| `gBrowser` | 浏览器窗口 | 标签页管理器（仅 `@include main` 时可用） |

### 懒加载 Firefox 模块

```js
// 推荐方式：defineESModuleGetters
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
    AddonManager: "resource://gre/modules/AddonManager.sys.mjs",
    CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
});

// 使用时通过 lazy.AddonManager 访问
```

```js
// 直接导入（适用于模块脚本）
const { IOUtils } = ChromeUtils.importESModule("resource://gre/modules/IOUtils.sys.mjs");
```

### 获取自身文件路径

```js
const SCRIPT_FILENAME = Components.stack.filename.split("/").pop().split("?")[0];
```

### 窗口卸载清理

```js
// 方式一：setUnloadMap（推荐，在沙箱中可用）
setUnloadMap("__myScript", function (key) {
    // 清理资源
});

// 方式二：直接监听 unload
window.addEventListener("unload", function () {
    // 清理资源
    window.removeEventListener("unload", arguments.callee, false);
}, false);
```

### 参考脚本

- `AddonsPage_fx72.uc.js` — 完整的 IIFE 封装、懒加载、幂等保护、l10n、偏好监听、样式注册

---

## 5. `.uc.mjs` 脚本编写

### 模式一：窗口回调（`onWindowLoad`）

适合需要在每个窗口执行初始化逻辑，同时利用 ESM 模块系统的脚本。

```js
// ==UserScript==
// @name            myModule.uc.mjs
// @description     每窗口初始化的自定义模块
// @author          YourName
// @version         2026.06.28
// @include         main
// @charset         UTF-8
// @compatibility   Firefox 146
// @note            2026.06.28 初始版本
// ==/UserScript==

// 模块级变量（跨窗口共享，因为 ESM 只 import 一次）
let initCount = 0;

// 导出 onWindowLoad，loader 会在每个匹配窗口调用它
export function onWindowLoad(win) {
    initCount++;
    const doc = win.document;

    // 操作窗口 DOM...
    // win._uc、win.xPref、win.UC 等全局对象可用
}

// 导出 onContentMessage，用于接收 content 侧消息（可选）
// export function onContentMessage(payload) {
//     console.log("收到消息:", payload.name, payload.data);
// }
```

**执行流程：** loader 通过 `ChromeUtils.importESModule` 导入模块 → 查找 `onWindowLoad` 导出 → 对每个匹配窗口调用 `onWindowLoad(win)`。

### 模式二：Custom Actor（`@actor`）

适合需要精确控制 JSWindowActor 注册参数的脚本。

```js
// ==UserScript==
// @name            myActor.uc.mjs
// @description     自定义 Actor 脚本
// @author          YourName
// @version         2026.06.28
// @include         main
// @actor           MyActor
// @actor:matches   https://example.com/*
// @actor:events    DOMContentLoaded
// @actor:allframes false
// @charset         UTF-8
// @compatibility   Firefox 146
// @note            2026.06.28 初始版本
// ==/UserScript==

// Parent（chrome 侧）— 浏览器进程中运行
export class MyActorParent extends JSWindowActorParent {
    receiveMessage({ name, data }) {
        switch (name) {
            case "getContentInfo":
                console.log("收到内容信息:", data);
                return { status: "ok" };
        }
    }

    actorCreated() {
        console.log("Actor 已创建");
    }

    didDestroy() {
        console.log("Actor 已销毁");
    }
}

// Child（content 侧）— 网页内容进程中运行
export class MyActorChild extends JSWindowActorChild {
    handleEvent(event) {
        if (event.type === "DOMContentLoaded") {
            const title = this.contentDocument.title;
            this.sendAsyncMessage("getContentInfo", { title });
        }
    }
}
```

**执行流程：** loader 读取 `@actor` 名称 → 设置 `parent.esModuleURI` 和 `child.esModuleURI` → 调用 `ChromeUtils.registerWindowActor` 注册。之后 `@include` 匹配的窗口中，Parent 类的实例会被创建。

### 模式三：Shared Content（`@content`）

适合将逻辑注入网页内容区域，多个脚本共享同一 actor 基础设施。

```js
// ==UserScript==
// @name            myContent.uc.mjs
// @description     注入内容页面的脚本
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
// @note            2026.06.28 初始版本
// ==/UserScript==

export const MyContentModule = {
    // content 侧事件处理器
    contentHandlers: {
        DOMContentLoaded(context) {
            // context.actor — JSWindowActorChild 实例
            // context.contentDocument — 内容文档
            // context.contentWindow — 内容窗口
            // context.sendToChrome(name, data) — 发送消息到 chrome 侧
            const title = context.contentDocument.title;
            context.sendToChrome("pageInfo", { title });
        },
    },

    // chrome 侧消息处理器（可选）
    onContentMessage(payload) {
        // payload.name — 消息名称
        // payload.data — 消息数据
        // payload.browser — 关联的 <browser> 元素
        console.log("收到 content 消息:", payload.name, payload.data);
    },
};
```

**执行流程：** loader 注册共享 `UcSharedActor` → 查找 `@export` 指定的模块导出 → 匹配 URL 时在 content 侧执行 `contentHandlers` 中对应事件的处理器。

---

## 6. `.sys.mjs` 脚本编写

### 模式一：工具模块（`@skip true`）

仅供其他脚本 `import` 的工具库，**不自动执行**。

```js
// ==UserScript==
// @name            myUtils.sys.mjs
// @description     DOM 工具函数集合
// @author          YourName
// @version         1.0.0
// @skip            true
// @note            2026.06.28 初始版本
// ==/UserScript==
'use strict';

/**
 * 等待指定元素出现在 DOM 中
 * @param {Document} doc - 目标文档
 * @param {string} selector - CSS 选择器
 * @param {number} [timeout=5000] - 超时时间（毫秒）
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
            reject(new Error(`等待 ${selector} 超时`));
        }, timeout);
    });
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}
```

**导入方式（在其他脚本中）：**

```js
// 在 .uc.js 中（通过 chrome:// URL）
const { waitForElement } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/userChromeJS/myUtils.sys.mjs"
);

// 在其他 .mjs 中（标准 ESM import）
import { waitForElement, formatFileSize } from "chrome://userchromejs/content/userChromeJS/myUtils.sys.mjs";
```

### 模式二：后台模块

`.sys.mjs` 默认按后台模块处理，首次窗口触发时 `ChromeUtils.importESModule` 一次，之后不再重复。

```js
// ==UserScript==
// @name            myObserver.sys.mjs
// @description     全局偏好变更观察器
// @author          YourName
// @version         1.0.0
// @charset         UTF-8
// @note            2026.06.28 初始版本
// ==/UserScript==
'use strict';

// 注意：后台模块没有 window/document/gBrowser
// 但可以访问 Services、ChromeUtils、Cc、Ci、Cu

const { Services } = globalThis;

const observer = {
    QueryInterface: ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]),

    observe(subject, topic, data) {
        if (topic === "nsPref:changed") {
            console.log("[myObserver] 偏好变更:", data);
        }
    },
};

// 模块顶层代码在首次 import 时执行一次
Services.prefs.addObserver("", observer, true);

// 导出供其他脚本使用
export { observer };
```

### 参考脚本

- `_uc.sys.mjs` — 兼容 API（`windows`、`createElement`、`createWidget`）
- `xPref.sys.mjs` — 偏好封装（`get`、`set`、`lock`、`addListener`）
- `ucf.sys.mjs` — 窗口卸载映射（`initUloadMap`、`setUnloadMap`）
- `hookFunction.mjs` — 函数钩子（before/after hook + unhook）

---

## 7. UC API 参考

### `UC` — WebExtension 追踪

由 `userChrome.js` 注入到每个 chrome 窗口。

```js
UC = {
    webExts: new Map(),   // addonId → 浏览器元素（WebExtension background 页面）
    sidebar: new Map(),   // addonId → Map<window, browser>（侧边栏扩展）
}
```

**观察者通知：**
- `UCJS:WebExtLoaded` — WebExtension background 加载完成，data 为 addonId
- `UCJS:SidebarLoaded` — 侧边栏加载完成，subject 为窗口，data 为 addonId

### `_uc` — 兼容性 API

通过 lazy getter 导入，来源为 `_uc.sys.mjs`。

| 属性/方法 | 说明 |
|-----------|------|
| `_uc.APPNAME` | 应用名（`"firefox"` 或 `"thunderbird"`） |
| `_uc.BROWSERCHROME` | 主窗口 URL（`"chrome://browser/content/browser.xhtml"`） |
| `_uc.BROWSERTYPE` | 窗口类型（`"navigator:browser"` 或 `"mail:3pane"`） |
| `_uc.BROWSERNAME` | 显示名（`"Firefox"` 或 `"Thunderbird"`） |
| `_uc.isFaked` | 始终为 `true`（本 loader 兼容标志） |
| `_uc.isESM` | 始终为 `true` |
| `_uc.sss` | `nsIStyleSheetService` 实例（样式表服务） |
| `_uc.chromedir` | `nsIFile` — UChrm 目录 |
| `_uc.windows(fun, onlyBrowsers)` | 遍历窗口，fun 接收 `(doc, win, location)` |
| `_uc.createElement(doc, tag, attrs, XUL)` | 创建元素，`on*` 属性自动注册事件监听 |
| `_uc.createWidget(desc)` | 创建 CustomizableUI 工具栏按钮 |

**`_uc.createWidget(desc)` 参数：**

```js
_uc.createWidget({
    id: "my-toolbar-button",           // 必填，唯一 ID
    type: "toolbarbutton",              // "toolbarbutton" 或 "toolbaritem"
    label: "我的按钮",
    tooltip: "点击执行操作",
    image: "chrome://path/to/icon.svg", // 或相对路径
    area: CustomizableUI.AREA_NAVBAR,   // 默认导航栏
    overflows: true,                     // 是否允许溢出到菜单
    class: "my-custom-class",
    callback: function (event, targetWin) {
        // 点击回调
    },
});
```

**`_uc.createElement` 示例：**

```js
const btn = _uc.createElement(doc, "toolbarbutton", {
    id: "my-btn",
    label: "点击我",
    tooltiptext: "自定义按钮",
    onclick: function (event) {
        console.log("被点击");
    },
});
```

### `xPref` — 偏好读写

通过 lazy getter 导入，来源为 `xPref.sys.mjs`。

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `xPref.get(path, def, valueIfUndefined, setDefault)` | 读取偏好 | `string` / `number` / `boolean` / `undefined` |
| `xPref.set(path, value, def)` | 写入偏好 | 写入的值 |
| `xPref.lock(path, value)` | 锁定偏好（锁定 + 设默认值） | — |
| `xPref.unlock(path)` | 解锁偏好 | — |
| `xPref.clear(path)` | 清除用户偏好（`clearUserPref`） | — |
| `xPref.addListener(path, callback)` | 监听偏好变更 | `{ prefPath, observer }` |
| `xPref.removeListener(obs)` | 移除监听 | — |

**`addListener` 用法：**

```js
// callback 接收 (newValue, prefPath)
const obs = xPref.addListener("browser.search.openintab", function (value, path) {
    console.log(path, "变为", value);
});

// 移除监听
xPref.removeListener(obs);
```

**`get` 类型推断：**
- type 32 → `getStringPref` → `string`
- type 64 → `getIntPref` → `number`
- type 128 → `getBoolPref` → `boolean`
- type 0（未注册）→ `undefined`

### `setUnloadMap` — 窗口卸载清理

由 `ucf.sys.mjs` 提供，在 `.uc.js` 沙箱中可用。

```js
// 注册清理回调
setUnloadMap("myKey", function (key) {
    // this === context
    // 窗口卸载时自动调用
    console.log("清理:", key);
});

// 同一个 key 注册多次会覆盖
setUnloadMap("myKey", function (key) {
    console.log("新的清理回调");
});
```

### `hookFunction` — 函数钩子

来自 `hookFunction.mjs`，需要在 `.uc.js` 中通过 `ChromeUtils.importESModule` 导入。

```js
const { hookFunction } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/utils/hookFunction.mjs"
);

// 在目标函数前后插入钩子
const unhook = hookFunction(
    targetObject,      // 函数所在的对象
    "methodName",      // 函数名
    function onBefore(...args) {
        // 在原函数执行前运行
        // 返回值会传递给 onAfter
        return null;
    },
    function onAfter(beforeResult, originalArgs, originalResult) {
        // 在原函数执行后运行
        // 返回值替换原函数的返回值
        return originalResult;
    }
);

// 移除钩子
unhook();
```

**注意：** 同一函数只能 hook 一次。可以通过 `.originalFunction` 访问原始函数。

---

## 8. Firefox API 常用导入

### Services（全局可用，无需导入）

```js
// Services 在所有脚本类型中均可直接通过 globalThis 访问
const { Services } = globalThis;

// Services 子对象
Services.prefs       // 偏好服务
Services.io          // URI / IO 服务
Services.wm          // 窗口管理器
Services.dirsvc      // 目录服务
Services.obs         // 观察者服务
Services.scriptloader // 脚本加载器
```

### 常用 ESM 导入路径

```js
const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
    // 附加组件管理
    AddonManager: "resource://gre/modules/AddonManager.sys.mjs",

    // 工具栏自定义
    CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",

    // 应用常量
    AppConstants: "resource://gre/modules/AppConstants.sys.mjs",

    // 文件与 IO
    IOUtils: "resource://gre/modules/IOUtils.sys.mjs",
    PathUtils: "resource://gre/modules/PathUtils.sys.mjs",

    // 异步工具
    setTimeout: "resource://gre/modules/Timer.sys.mjs",
    clearInterval: "resource://gre/modules/Timer.sys.mjs",
    clearTimeout: "resource://gre/modules/Timer.sys.mjs",

    // 控制台
    console: "resource://gre/modules/Console.sys.mjs",

    // 私有浏览
    PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});
```

### 在 `.sys.mjs` 中直接导入

```js
const { Services } = globalThis;
const { IOUtils, PathUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/IOUtils.sys.mjs"
);
```

### 跨脚本导入 userChromeJS 模块

```js
// 导入工具模块
const { someUtil } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/userChromeJS/myUtils.sys.mjs"
);

// 导入内置工具
const { hookFunction } = ChromeUtils.importESModule(
    "chrome://userchromejs/content/utils/hookFunction.mjs"
);
```

---

## 9. 编码规范要点

### 幂等与清理

所有可能重复执行的脚本都必须考虑重复初始化：

```js
// 1. 检查是否已初始化
if (window.MyScript) {
    window.MyScript.uninit();
    delete window.MyScript;
}

// 2. 使用 setUnloadMap 注册清理
setUnloadMap("__myScript", function () {
    // 清理事件监听、样式、DOM 节点等
});

// 3. 创建 DOM 前检查是否已存在
if (doc.getElementById("my-custom-btn")) return;
```

### chrome/content 逻辑分离

- **chrome 侧：** 浏览器 UI 修改 → `.uc.js` 或 `.uc.mjs` 的 chrome 逻辑
- **content 侧：** 网页内容操作 → actor/content 模式
- **不要**在 chrome 窗口逻辑中直接操作 `gBrowser.selectedBrowser.contentDocument`

### 窗口获取 fallback 链

```js
// 优先使用新 API，fallback 到旧 API
const win = element.documentGlobal
    || element.ownerGlobal
    || element.ownerDocument?.defaultView;
```

### 脚本发现目录

Loader 按以下顺序扫描 `profile/chrome/` 下的子目录：

```
"" > "xul" > "TabMixPlus" > "withTabMixPlus" > "SubScript" > "UCJSFiles"
> "userCrome.js.0.8" > "userContent" > "userMenu" > "UserChromeJS"
```

同一目录下按文件名字母序执行。

### 脚本禁用

通过偏好控制（逗号分隔的文件名列表）：
- `userChrome.disable.directory` — 禁用整个目录
- `userChrome.disable.script` — 禁用指定脚本

---

## 10. 常见模式速查

### 创建工具栏按钮

```js
_uc.createWidget({
    id: "my-custom-btn",
    type: "toolbarbutton",
    label: "我的按钮",
    tooltip: "点击执行操作",
    image: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='7' fill='blue'/></svg>",
    callback: function (event, win) {
        win.alert("按钮被点击");
    },
});
```

### 注册全局样式表

```js
const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);

const css = `
    @namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");
    #my-btn { background: red !important; }
`;
const uri = Services.io.newURI("data:text/css," + encodeURIComponent(css));
sss.loadAndRegisterSheet(uri, sss.USER_SHEET);

// 清理
setUnloadMap("__myStyle", function () {
    sss.unregisterSheet(uri, sss.USER_SHEET);
});
```

### 遍历浏览器窗口

```js
_uc.windows(function (doc, win, location) {
    // 对每个浏览器窗口执行
    console.log(win.location.href);
    // 返回 true 停止遍历
    return false;
}, true); // true = 仅浏览器窗口
```

### 偏好持久化

```js
// 读取（不存在则设默认值并返回）
const myPref = xPref.get("extensions.myScript.enabled", false);

// 写入
xPref.set("extensions.myScript.enabled", true);

// 监听变化
const obs = xPref.addListener("extensions.myScript.enabled", function (value) {
    console.log("偏好变更:", value);
});

// 清理监听
setUnloadMap("__myPrefObserver", function () {
    xPref.removeListener(obs);
});
```

### 等待 DOM 元素

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

### observer 注册与清理

```js
const observer = {
    QueryInterface: ChromeUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]),
    observe(subject, topic, data) {
        if (topic === "browser-delayed-startup-finished") {
            // 浏览器启动完成
        }
    },
};

Services.obs.addObserver(observer, "browser-delayed-startup-finished");

setUnloadMap("__myObserver", function () {
    Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
});
```

### 打开链接 / 文件

```js
// 打开 URL
window.openTrustedLinkIn("https://example.com", "tab");

// 打开 about: 页面
window.openTrustedLinkIn("about:config", "tab");

// 打开文件所在目录
const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
file.initWithPath("C:\\path\\to\\file");
if (file.exists()) file.reveal();

// 复制到剪贴板
Cc["@mozilla.org/widget/clipboardhelper;1"]
    .getService(Ci.nsIClipboardHelper).copyString("要复制的文本");
```
