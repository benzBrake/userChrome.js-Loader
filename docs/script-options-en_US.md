# Script Options and `@pref` Reference

> This is the detailed reference for script authors and complements the [Script Authoring Guide](./GUIDE-en_US.md). 中文版：[脚本选项与 `@pref` 参考](./script-options.md)。

Scripts declare settings to display in about:addons with `@pref` entries in their metadata block. The loader only collects and validates declarations. The script details page in AddonsPage provides “Details” and “Options” tabs and uses Firefox's preference service to read and save values.

The first phase supports only preferences corresponding to about:config. It does not execute declaration code, scan script bodies for `get*Pref()`, provide custom HTML or script callbacks, or collect preferences using wildcards.

## Data Flow and Responsibilities

```text
Script header @pref JSON
    → UcScriptOptions.parseOptions()
    → script.options / script.optionErrors
    → ScriptAddon.scriptOptions / scriptOptionErrors
    → UcScriptOptionsUI.mountScriptOptions()
    → Services.prefs
```

- `userChrome.js`: collects options during the existing metadata parsing flow for `.uc.js`, `.uc.mjs`, and other supported script formats. Disabled scripts also retain their declarations.
- `utils/UcScriptOptions.sys.mjs`: validates the schema and values, resolves translations, reads and writes preferences, converts paths, and manages observers.
- `utils/UcScriptOptionsUI.sys.mjs`: mounts and cleans up the form, error display, native file picker, and native named-deck tab.
- `userChromeJS/AddonsPage_fx72.uc.js`: adapts `ScriptAddon`, mounts the options UI at the details page lifecycle points, and provides styles. Other loader backends show an empty state when they have no options metadata.
- `userChrome.d.ts`: provides declaration types for script authors.

Importing the options module does not modify preferences. A parsing error disables only the affected declaration and does not prevent the script from loading. Returned arrays and normalized declarations are frozen. If a key is repeated within a script, the first valid declaration is retained and later duplicates are reported as errors.

## Declaration Syntax

Use one strict JSON object per line between `// ==UserScript==` and `// ==/UserScript==`. Preserve the existing line ending format in the header. Multiline JSON, trailing commas, JavaScript expressions, and functions are unsupported.

```js
// ==UserScript==
// @name Example.uc.js
// @pref {"key":"userChrome.example.enabled","type":"bool","label":{"default":"Enabled","zh-CN":"启用"}}
// @pref {"key":"userChrome.example.encoding","type":"string","label":{"default":"Encoding","zh-CN":"编码"}}
// @pref {"key":"userChrome.example.timeout","type":"number","label":"Timeout","min":0,"max":60000,"fallback":1000}
// @pref {"key":"userChrome.example.mode","type":"enum","valueType":"string","label":"Mode","choices":[{"value":"auto","label":{"default":"Automatic","zh-CN":"自动"}},{"value":"manual","label":{"default":"Manual","zh-CN":"手动"}}]}
// ==/UserScript==
```

| Field | Required | Meaning |
| --- | --- | --- |
| `key` | Yes | Full preference key; must be non-empty and contain no whitespace. |
| `type` | Yes | `bool`, `string`, `number`, `enum`, or `complex`. |
| `label` | No | Display name; defaults to the key. |
| `description` | No | Additional help text. |
| `group` | No | Group name. Groups follow their first appearance; declarations retain their order within each group. |
| `fallback` | No | Describes the default implemented by the script; it is not written to Firefox's default branch. |
| `min` / `max` | `number` | Optional inclusive integer bounds. |
| `valueType` / `choices` | `enum` | The underlying value type and a non-empty list of choices. |
| `interface` | `complex` | `nsIFile` or `nsIPrefLocalizedString`. |
| `control` | No | `filepicker` adds a “Browse…” button to a path input. |
| `path` | Path settings | Base directory and storage format; see below. |
| `picker` | No | File picker mode and filters. |

`fallback` must match the declared type, numeric bounds, and enum choices. Path fallbacks are resolved when used. Unknown extension fields are ignored for now; malformed known fields are reported as errors.

## Labels and Localization

`label`, `description`, `group`, enum choice `label`, and file filter `label` accept either a string or a localization object:

```json
{"default":"Configuration file","zh-CN":"配置文件","ja":"設定ファイル"}
```

The localization object must have a string-valued `default`; all other values must also be strings. Locales are tried in Firefox's `appLocalesAsBCP47` order. For each locale, the full language tag is matched first, then its base language; after all locales, `default` is used. Matching is case-insensitive. Empty translations are supported, and no automatic Simplified/Traditional Chinese conversion is performed.

Localization of option labels is unrelated to how `nsIPrefLocalizedString` preference **values** are handled. Enums store the choice `value`, not its translated label. When the application language changes, the form is recreated the next time the details page is refreshed.

## Value Types and Storage

Firefox's basic preference storage types are string, integer, and boolean. The UI type does not always match the underlying storage type.

| Declaration | Storage and control |
| --- | --- |
| `bool` | Boolean; checkbox. |
| `string` | Unicode string; text input using `getStringPref/setStringPref`. |
| `number` | Signed 32-bit integer; number input using `getIntPref/setIntPref`. |
| `enum` | Dropdown; `valueType` is `string`, `number`, or `bool`, stored with the corresponding basic type API. |
| `complex` + `nsIFile` | File object displayed as `.path`; uses `getComplexValue/setComplexValue`. |
| `complex` + `nsIPrefLocalizedString` | Displays `.data`; saves an object implementing the same interface. |

Numbers range from `-2147483648` to `2147483647`. Input rejects empty values, decimals, exponent notation, hexadecimal values, and out-of-range values; values are not truncated.

Enum choices have the form `{"value":0,"label":"Automatic"}`. Choice values must match `valueType` and be unique. If the stored value is not in the list, the UI displays the original value and a notice until the user selects a new value.

Firefox serializes `nsIFile` preferences using a persistent descriptor. Do not assume that all platforms store them as path text. This differs from the protocol for storing a path in a string preference; declarations must match the API already used by the script. The first phase does not support `nsIRelativeFilePref`, the deprecated `nsISupportsString`, or arbitrary object/JSON complex values.

## Relative Paths and File Picker

Declare path purpose, preference storage type, and picker control separately. The existing addMenuPlus code uses `getStringPref("addMenu.FILE_PATH")` and resolves the value relative to the chrome directory, so its declaration uses `string`:

```js
// @pref {"key":"addMenu.FILE_PATH","type":"string","control":"filepicker","path":{"base":"UChrm","format":"relative"},"picker":{"mode":"open","filters":[{"label":{"default":"JavaScript files","zh-CN":"JavaScript 文件"},"pattern":"*.js"}]},"fallback":"_addmenu.js","label":{"default":"Configuration file","zh-CN":"配置文件"},"description":{"default":"Relative to the profile chrome directory. Restart Firefox after changing this path.","zh-CN":"路径相对于配置目录下的 chrome 文件夹，修改后重启 Firefox 生效。"}}
```

### `path`

Allowed `base` values:

- `UChrm`: the current profile's chrome directory.
- `ProfD`: the current profile root directory.
- `script`: the directory containing the current script file, not the browser process working directory.

Allowed `format` values:

- `relative`: stores only paths relative to the base directory. Absolute input and files chosen in the picker are converted to relative paths; targets outside the base are rejected.
- `absolute`: accepts and stores only absolute paths.
- `prefer-relative`: stores paths inside the base as relative and paths outside it as absolute. Use this only after confirming that the script supports both formats.

A string path must declare `path` to use `filepicker`. `complex`/`nsIFile` includes a file picker by default and always stores a file object. If `path` is specified for it, `format` must be `absolute`; `base` sets the picker's initial directory.

Relative input accepts `/` or `\`; output uses the base directory's platform separator. Empty paths, control characters, empty path segments, and `..` are rejected. `.` represents the base directory itself and is useful for folder options. Environment variables, `~`, and URLs are not expanded, and directories are not created. Native file parent relationships are used to check whether a target is inside the base, avoiding false matches from string prefixes.

These rules govern only the format saved by the options page; they do not change how scripts read the value. The existing relative-path handling in addMenuPlus continues to work, but this declaration does not make it support absolute paths automatically.

### `picker`

```json
{"mode":"open","filters":[{"label":"JavaScript files","pattern":"*.js; *.mjs"}]}
```

- `mode`: `open` (default, choose an existing file) or `folder` (choose a directory). Saving files and multi-select are not supported yet.
- `filters`: patterns passed to `nsIFilePicker.appendFilter()`; an “All Files” filter is also added.
- The native picker is initialized with the browser window's `browsingContext` and opened asynchronously.
- The initial directory comes from the current input or script fallback when possible, then falls back to the base directory.
- Canceling does not write the preference. When the callback returns, its result is discarded if the details page has been left, the declaration has changed, the tab is no longer on Options, or the component has been unloaded. Lock and type are checked again before saving.

## User Values, Defaults, and Saving

- If no preference exists and no `fallback` is declared, the UI shows “Not configured” and opening the page does not create a value. A declared `fallback` is shown as “Using script default: value” but does not become a Firefox default value.
- If a default-branch value exists, the UI shows “Using Firefox default: value”. A default value indicates the source of the setting; it does not mean a boolean switch is off. Booleans display as On/Off, and enums display their translated choice labels.
- Editing writes to the user branch and shows “Customized”. The Firefox default or script fallback is shown as the target that will apply after the custom value is removed.
- Reset calls `clearUserPref()`: an existing Firefox default is restored; otherwise the preference returns to the unset state.
- Locked preferences cannot be edited or reset. If the stored type conflicts with the declaration, direct writes are disabled, but a user value may first be reset. A type conflict in the default branch remains visible.
- Boolean and enum changes are committed immediately. Text and number inputs are committed on change/blur or Enter. Esc discards uncommitted input and reloads the value.
- Validation errors preserve the input and appear inline; values are not converted implicitly.
- Changes from other options pages and about:config are observed. While a row is being edited, its input is preserved and an external-change notice is shown. Esc reloads the value; continuing to submit saves the current input.
- Saving does not reload the script automatically. Whether a change takes effect immediately depends on the script; use `description` to indicate when a restart or reinitialization is needed.

## Details Page Lifecycle

The options page is added only for `userchromejs` addons. It reuses the native `.tab-group` and `named-deck`, adding a `ucjs-options` button and section. Avoid the native `preferences` name, which can trigger the extension options browser. The first tab retains the complete existing details; the existing `@optionsURL` remains a link.

Mount identity includes the `ScriptAddon`, details section, declaration/error content, `optionsURL`, and application locale. The form is not rebuilt when the identity is unchanged; ordinary preference notifications refresh only the affected row. Existing additional details refresh independently of the form so inputs and focus remain stable.

The form stops `click`, `change`, `input`, and `keydown` events from bubbling to `addon-card`, so an ordinary checkbox is not mistaken for the script enable switch. Switching scripts, leaving the details page, closing the document, or unloading AddonsPage releases preference observers and tab nodes. Late file picker callbacks cannot write values after teardown.

The UI module attaches styles to the document and removes them with the component, avoiding the XUL default namespace from older AddonsPage global styles affecting HTML selectors. Groups and setting rows separate names, preference keys, descriptions, and status. Boolean switches are on the right; text and path inputs use the full row. The layout supports narrow panels, light and dark themes, reduced motion, and forced colors. Reset icons have accessible names and descriptions and clear only the user branch; they do not write the declared fallback.

## Verification

`tests/script-options.test.mjs` covers declaration error isolation, locale fallback, numeric boundaries, invalid enum values, user/default values, locked preferences, type conflicts, path conversion, complex preferences, and observer cleanup. The full check is `npm run check`. Firefox verification should also cover the native tab, input event isolation, file picker selection/cancel, asynchronous callbacks after navigation, and theme display.

## Firefox Source References

- [nsIPrefBranch.idl](https://searchfox.org/firefox-main/source/modules/libpref/nsIPrefBranch.idl): basic types, default and user branches, and complex APIs.
- [libpref](https://firefox-source-docs.mozilla.org/modules/libpref/index.html): storage model and numeric limits.
- [Preferences.cpp](https://searchfox.org/firefox-main/source/modules/libpref/Preferences.cpp): `nsIFile` persistent descriptors and localized string conversion.
- [nsIFilePicker.idl](https://searchfox.org/firefox-main/source/widget/nsIFilePicker.idl): `BrowsingContext`, filters, and asynchronous picker results.
- [addon-details.mjs](https://searchfox.org/firefox-main/source/toolkit/mozapps/extensions/content/components/addon-details.mjs) and [named-deck.js](https://searchfox.org/firefox-main/source/toolkit/content/widgets/named-deck.js): native tabs and deck lifecycle.

These links point to the moving Firefox main branch. For behavior across Firefox versions, consult the source and runtime results for the target version.
