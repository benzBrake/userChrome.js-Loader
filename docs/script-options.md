# 脚本选项与 `@pref` 参考

> 本文是脚本作者的详细参考，补充 [脚本编写指南](./GUIDE.md) 中的基础内容。英文版：[Script Options and `@pref` Reference](./script-options-en_US.md)。

脚本通过头部的 `@pref` 声明需要在 about:addons 中展示的配置。Loader 只收集、校验声明；AddonsPage 的脚本详情页提供“详细信息 / 选项”两个 tab，通过 Firefox 的 preference service 读取和保存值。

第一阶段只支持 about:config 对应的首选项，不执行声明中的代码，不扫描脚本正文中的 `get*Pref()`，不提供自定义 HTML、脚本回调或通配符 pref 收集。

## 数据流与职责

```text
脚本头 @pref JSON
    → UcScriptOptions.parseOptions()
    → script.options / script.optionErrors
    → ScriptAddon.scriptOptions / scriptOptionErrors
    → UcScriptOptionsUI.mountScriptOptions()
    → Services.prefs
```

- `userChrome.js`：在现有元数据解析流程中收集选项，兼容 `.uc.js`、`.uc.mjs` 和其他已有脚本格式。禁用的脚本也有声明数据。
- `utils/UcScriptOptions.sys.mjs`：schema 校验、翻译回退、值校验、pref 读写、路径转换与观察器生命周期。
- `utils/UcScriptOptionsUI.sys.mjs`：表单、错误展示、原生文件选择器与原生 named-deck tab 的挂载和清理。
- `userChromeJS/AddonsPage_fx72.uc.js`：提供 ScriptAddon 适配、详情页挂载时机与样式。其他 Loader 后端没有选项元数据时展示空状态。
- `userChrome.d.ts`：作者可用的声明类型。

导入选项模块不会修改 pref。解析错误只禁用对应声明，不阻止脚本加载。返回数组及规范化声明被冻结；同一脚本内 key 重复时保留第一条有效声明，后续条目记为错误。

## 声明语法

每行一个严格 JSON 对象，放在 `// ==UserScript==` 与 `// ==/UserScript==` 之间。保持原有头部的行尾格式；不支持跨行 JSON、尾逗号、JS 表达式或函数。

```js
// ==UserScript==
// @name Example.uc.js
// @pref {"key":"userChrome.example.enabled","type":"bool","label":{"default":"Enabled","zh-CN":"启用"}}
// @pref {"key":"userChrome.example.encoding","type":"string","label":{"default":"Encoding","zh-CN":"编码"}}
// @pref {"key":"userChrome.example.timeout","type":"number","label":"Timeout","min":0,"max":60000,"fallback":1000}
// @pref {"key":"userChrome.example.mode","type":"enum","valueType":"string","label":"Mode","choices":[{"value":"auto","label":{"default":"Automatic","zh-CN":"自动"}},{"value":"manual","label":{"default":"Manual","zh-CN":"手动"}}]}
// ==/UserScript==
```

| 字段 | 必填 | 语义 |
| --- | --- | --- |
| `key` | 是 | 完整 pref key，非空且不含空白字符 |
| `type` | 是 | `bool`、`string`、`number`、`enum` 或 `complex` |
| `label` | 否 | 显示名称，省略时显示 key |
| `description` | 否 | 辅助说明 |
| `group` | 否 | 分组名称，按首次出现顺序排列；组内保持声明顺序 |
| `fallback` | 否 | 描述脚本自行实现的缺省值，不写入 Firefox 默认分支 |
| `min` / `max` | number | 可选整数范围，包含端点 |
| `valueType` / `choices` | enum | 实际值类型和非空候选列表 |
| `interface` | complex | `nsIFile` 或 `nsIPrefLocalizedString` |
| `control` | 否 | `filepicker`，给路径输入附加“浏览…”按钮 |
| `path` | 路径配置 | 基准目录和保存格式，详见后文 |
| `picker` | 否 | 文件选择模式与过滤器 |

`fallback` 必须符合对应类型、数字范围和枚举候选值。路径 fallback 的解析在使用时完成。未知的扩展字段暂不使用；已知字段格式不合法时报告错误。

## 默认文案和翻译

`label`、`description`、`group`、枚举项的 `label`、文件过滤器的 `label` 都接受字符串或翻译对象：

```json
{"default":"Configuration file","zh-CN":"配置文件","ja":"設定ファイル"}
```

翻译对象必须有字符串类型的 `default`，其他值也必须是字符串。按 Firefox 的 `appLocalesAsBCP47` 顺序逐一匹配：完整语言标签、基础语言，再尝试下一种语言，最后使用 `default`；匹配不区分大小写。支持空字符串译文，不自动进行简繁互转。

这是选项文案的翻译，与 `nsIPrefLocalizedString` 对 pref **值**的解析机制无关。枚举保存 `value`，不保存译文。改变应用语言后，详情页下次刷新会重新创建表单。

## 值类型和存储

Firefox 的基本 pref 存储只有 string、int、bool。UI 类型不一定等于底层存储类型。

| 声明类型 | 存储及控件 |
| --- | --- |
| `bool` | bool，复选框 |
| `string` | Unicode 字符串，文本框，使用 `getStringPref/setStringPref` |
| `number` | 有符号 32 位整数，数字输入框，使用 `getIntPref/setIntPref` |
| `enum` | 下拉框；`valueType` 为 `string/number/bool`，使用对应基础类型 API |
| `complex` + `nsIFile` | 文件对象，显示 `.path`；使用 `getComplexValue/setComplexValue` |
| `complex` + `nsIPrefLocalizedString` | 显示 `.data`；保存时创建同接口对象 |

number 的范围为 `-2147483648` 至 `2147483647`。输入拒绝空值、小数、指数形式、十六进制和越界值，不进行截断。

enum 的候选项形如 `{"value":0,"label":"Automatic"}`。候选值必须与 `valueType` 一致且不可重复。读取到列表外的值时显示原值和提示，直到用户主动选择新值。

`nsIFile` 在 pref 中通过 Firefox 的 persistent descriptor 序列化，不应假定所有平台都直接保存路径文本。它与“用 string 保存路径”的协议不同，已有脚本使用什么读取 API，声明就应保持什么类型。第一阶段不支持 `nsIRelativeFilePref`、已弃用的 `nsISupportsString` 或任意对象/JSON complex。

## 相对路径和文件选择器

路径用途、pref 存储类型、选择器控件分别声明。addMenuPlus 的现有代码使用 `getStringPref("addMenu.FILE_PATH")`，再相对 chrome 目录解析，因此声明为 string：

```js
// @pref {"key":"addMenu.FILE_PATH","type":"string","control":"filepicker","path":{"base":"UChrm","format":"relative"},"picker":{"mode":"open","filters":[{"label":{"default":"JavaScript files","zh-CN":"JavaScript 文件"},"pattern":"*.js"}]},"fallback":"_addmenu.js","label":{"default":"Configuration file","zh-CN":"配置文件"},"description":{"default":"Relative to the profile chrome directory. Restart Firefox after changing this path.","zh-CN":"路径相对于配置目录下的 chrome 文件夹，修改后重启 Firefox 生效。"}}
```

### `path`

`base` 可选值：

- `UChrm`：当前 profile 的 chrome 文件夹。
- `ProfD`：当前 profile 根目录。
- `script`：当前脚本文件所在目录，不是浏览器进程的工作目录。

`format` 可选值：

- `relative`：只保存基准目录内的相对路径。输入绝对路径或通过选择器选中文件后，会转换为相对路径；目录外目标拒绝保存。
- `absolute`：只接受和保存绝对路径。
- `prefer-relative`：基准目录内保存相对路径，目录外保存绝对路径。使用前必须确认脚本本身支持两种格式。

string 路径必须明确指定 `path` 才可使用 filepicker。complex/nsIFile 默认带 filepicker，始终保存文件对象；如果指定 `path`，其 `format` 只能是 `absolute`，`base` 用于选择器的初始目录。

相对输入接受 `/` 或 `\`，输出使用基准目录所在平台的分隔符；禁止空路径、控制字符、空路径片段与 `..`。`.` 表示基准目录本身，供文件夹选项使用。不展开环境变量、`~` 或 URL，不进行目录创建。通过原生文件父级关系判断目标是否位于基准目录内，避免字符串前缀误判。

这些规则只管理选项页的保存格式，不修改脚本的读取逻辑。addMenuPlus 已有的相对路径读取方式继续有效，但不会因此自动获得绝对路径支持。

### `picker`

```json
{"mode":"open","filters":[{"label":"JavaScript files","pattern":"*.js; *.mjs"}]}
```

- `mode`：`open`（默认，选已有文件）或 `folder`（选择目录）；暂不支持保存文件或多选。
- `filters`：使用 `nsIFilePicker.appendFilter()` 的过滤表达式，另附加“所有文件”。
- 通过浏览器窗口的 `browsingContext` 初始化原生选择器，使用异步 `open()`。
- 初始目录优先来自当前输入/脚本 fallback，找不到时尝试基准目录。
- 取消不写 pref。回调返回时若详情页已离开、声明已替换、tab 已切回详细信息或组件已卸载，则丢弃结果；保存前仍重新检查锁定和类型。

## 用户值、默认值和保存行为

- 没有 pref 且未声明 `fallback` 时显示“尚未配置”，不会因打开页面创建值。声明的 `fallback` 显示为“使用脚本预设：具体值”，但不会变成 Firefox 默认值。
- 使用默认分支时显示“使用 Firefox 默认：具体值”；默认值是配置的来源，不代表布尔开关处于关闭状态。布尔值显示为“开启 / 关闭”，枚举显示翻译后的候选名称。
- 修改值写入用户分支，显示“已自定义”；旁边展示 Firefox 默认值或脚本预设，说明移除自定义配置后的回退目标。
- 重置调用 `clearUserPref()`：有 Firefox 默认值则恢复默认，没有则重新变为未设置。
- 锁定项禁止编辑和重置。底层类型与声明不符时禁止直接写入，允许先重置用户值；默认分支类型仍不符时继续显示冲突。
- bool 和 enum 修改立即提交；文本和数字在 change/失焦或 Enter 时提交。Esc 放弃尚未提交的输入并重新读取。
- 校验失败保留输入并显示行内错误，不进行隐式转换。
- 同步监听其他选项页和 about:config 的修改；正在编辑的行保留输入并提示外部变化。Esc 可重新载入，继续提交则以输入值为准。
- 保存不会自动重载脚本。是否立即生效由脚本实现决定；可通过 description 提示需要重启或重新初始化。

## 详情页生命周期

只为 `userchromejs` 类型增加选项页。复用原生 `.tab-group` 和 `named-deck`，新增 `ucjs-options` 按钮与 section；避免使用原生 `preferences` 名称触发扩展选项浏览器。第一个 tab 保留原有完整详情；原 `@optionsURL` 继续作为链接展示。

挂载身份包含 ScriptAddon、详情 section、声明/错误内容、optionsURL 和应用语言。身份不变时不重建表单；普通 pref 通知仅刷新对应行。原来的附加详情信息刷新与表单独立，保持输入节点和焦点稳定。

表单阻止 click/change/input/keydown 事件冒泡到 addon-card，避免普通复选框被识别为脚本启用开关。切换脚本、离开详情、关闭文档或卸载 AddonsPage 时释放 pref 观察器和 tab 节点；晚到的选择器回调不能继续写入。

选项样式由 UI 模块挂载到文档并随组件释放，避免旧版 AddonsPage 全局样式的 XUL 默认命名空间影响 HTML 选择器。按分组标题和设置行排版，名称、配置键、说明与状态分层展示；布尔开关位于右侧，文本/路径输入使用整行。适配窄面板、深浅色主题、减少动态效果和强制色彩模式。重置图标有可访问名称与说明，只清除用户分支，不写入声明的 fallback。

## 验证范围

`tests/script-options.test.mjs` 覆盖声明错误隔离、翻译回退、数值边界、枚举异常、用户/默认值、锁定、类型冲突、路径转换、complex 适配与观察器清理。完整检查使用 `npm run check`。Firefox 中还需验证原生 tab、输入事件隔离、文件选择/取消、导航后的异步回调与主题显示。

## Firefox 源码参考

- [nsIPrefBranch.idl](https://searchfox.org/firefox-main/source/modules/libpref/nsIPrefBranch.idl)：基础类型、默认/用户分支、complex API。
- [libpref](https://firefox-source-docs.mozilla.org/modules/libpref/index.html)：存储模型与数值限制。
- [Preferences.cpp](https://searchfox.org/firefox-main/source/modules/libpref/Preferences.cpp)：nsIFile persistent descriptor 与 localized string 转换。
- [nsIFilePicker.idl](https://searchfox.org/firefox-main/source/widget/nsIFilePicker.idl)：BrowsingContext、过滤器和异步选择结果。
- [addon-details.mjs](https://searchfox.org/firefox-main/source/toolkit/mozapps/extensions/content/components/addon-details.mjs)、[named-deck.js](https://searchfox.org/firefox-main/source/toolkit/content/widgets/named-deck.js)：原生 tab 和 deck 生命周期。

以上为动态主干链接；跨 Firefox 版本的行为以目标版本源码和运行结果为准。
