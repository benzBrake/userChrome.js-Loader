# userChrome.js Loader 版本与发布方案

本文定义 userChrome.js Loader 的版本、兼容性、构建产物和发布方式，供 Loader 仓库和 RunFirefox 下载器共同使用。

## 目标

Loader 仓库应提供明确、不可歧义的发行版本和机器可读的发布索引。

版本系统需要同时表达四件不同的事情：

| 字段                  | 含义                         | 示例                              |
| --------------------- | ---------------------------- | --------------------------------- |
| Loader version        | Loader 自身的功能和 API 版本 | `3.1.0`                         |
| Firefox compatibility | 适用的 Firefox 版本范围      | `firefox-136-155`               |
| Revision              | 生成构建包的 Git commit      | `ccbcc9e`                       |
| Release channel       | 发布稳定性                   | `stable`、`beta`、`nightly` |

这四个字段不可互相替代。Firefox 兼容范围不是 Loader 版本；`nightly` 是滚动开发通道，也不是稳定版本。

## 版本号规则

采用 Semantic Versioning（SemVer），版本格式为 `MAJOR.MINOR.PATCH`。

- `MAJOR`：不兼容的 Loader API、脚本生命周期或安装目录结构变化。
- `MINOR`：向后兼容的新功能或新 API。
- `PATCH`：Bug 修复、Firefox 版本适配和内部实现修复。

版本唯一来源为根目录 `package.json` 的 `version` 字段：

```json
{
  "name": "userchrome-js-loader",
  "version": "3.1.0"
}
```

构建脚本、归档文件名、manifest 和 Release 说明都应从该字段读取，不要在多个源文件中手工维护版本号。

当前 `userChrome.js` 中的 `@version` 注释可以继续用于记录面向开发者的变更日期，但不作为发布版本或更新比较依据。

## 兼容产物

默认从同一个正式版本 commit 生成 Firefox 兼容产物。兼容范围写入
manifest 和归档文件名，不作为正式 release tag：

```text
main
compatibility: firefox-136-155
```

兼容范围的唯一来源是构建脚本中的兼容通道配置表（例如 `scripts/build.mjs`
中的 `COMPAT_CHANNELS`），ZIP 文件名、manifest 的 `compatibility` 与
`firefox` 字段、版本索引条目都由它生成；本文档只描述格式，不含具体数字。

**兼容范围必须互不重叠、首尾相接**（如 `136-155`、`156-170`、`171-`），
每个 Firefox 主版本恰好命中一个产物。发布 workflow 应校验新增范围与已有
范围不交叉，机器约束优先于人工约定。因此客户端只需按
`minFirefox <= version <= maxFirefox` 选择唯一命中的产物，无需 tie-break
规则；`maxFirefox: null` 表示无上限。

只有在不同 Firefox 范围需要长期维护不同代码时，才建立兼容分支。若使用兼容分支，
发布 workflow 必须明确为每个产物记录独立的 source revision；不能假设一个 Git tag
同时指向多个分支。

当前 main 分支只有一份代码，首个正式版本只发布一个兼容产物即可；仅当不同
范围需要不同代码（例如某个 Firefox 版本起 API 变化）时才扩展为多个产物：

```text
v3.1.0（未来扩展为多产物时的形态）
  userchromejs-loader-3.1.0-firefox-136-155.zip
  userchromejs-loader-3.1.0-firefox-156-170.zip
```

当 Firefox 进入新的兼容范围时，增加兼容产物即可；不需要为每个 Firefox 版本创建
一个 Loader 主版本。

## Git tag 与发布通道

正式版本使用不可移动的 Git tag：

```text
v3.1.0
v3.1.1
```

正式 tag 应触发稳定版 Release。发布后不得移动或复用已经使用过的正式 tag。

`nightly` 可以继续作为可移动 tag，用于当前开发线的自动构建。Nightly Release 必须标记为 prerelease，且不应被 RunFirefox 的稳定更新检查选中。Nightly 的显示版本建议包含基础版本、日期和短 commit：

```text
3.2.0-nightly.20260921+ccbcc9e
```

如需 Beta 通道，可使用不可移动的预发布 tag，例如 `v3.2.0-beta.1`，但 Beta 和 Stable 必须使用不同的更新索引。

## 构建产物

每个归档包都应包含一个机器可读的 `install-manifest.json`。下面是简化示例；实际
清单由构建脚本生成完整的逐文件列表：

```json
{
  "product": "userChrome.js-Loader",
  "version": "3.1.0",
  "revision": "ccbcc9e",
  "compatibility": "firefox-136-155",
  "releaseChannel": "stable",
  "firefox": {
    "min": 136,
    "max": 155
  },
  "builtAt": "2026-09-21T10:00:00Z",
  "files": [
    "program/defaults/pref/config-prefs.js",
    "profile/chrome/userChrome.js",
    "profile/chrome/utils/_uc.sys.mjs",
    "profile/chrome/utils/BootstrapLoader.js",
    "profile/chrome/userChromeJS/AddonsPage_fx72.uc.js"
  ]
}
```

`files` 是 Loader 明确拥有的文件列表，而不是可递归覆盖的目录列表。`files`
中的路径是**安装到 profile/程序目录后的目标相对路径**，不是仓库中的源码路径
（源码位于 `src/` 下，与部署路径不同，构建时由构建脚本完成映射）。更新时只
替换当前和上一个 manifest 声明的文件，不覆盖用户自行添加的 `.uc.js` 脚本或
其他 profile 内容。安装器还必须拒绝绝对路径、`..` 路径、符号链接和清单外文件。

正式 Release 至少应提供（首个版本只有一个兼容产物）：

```text
userchromejs-loader-3.1.0-firefox-136-155.zip
install-manifest-firefox-136-155.json
SHA256SUMS
```

## 发布索引与固定访问地址

版本索引作为仓库中的受控文件提交，供 RunFirefox 通过 jsDelivr 读取；GitHub
Release 只负责承载归档包、安装清单和校验文件。客户端不解析 Release 页面，也不
把某个 Release asset 作为“最新版本”入口。

索引文件固定放在仓库根目录：

```text
version.json          # stable，RunFirefox 默认读取
version-beta.json     # beta，只有测试选项开启时读取
version-nightly.json  # nightly，只有测试选项开启时读取
```

稳定索引应只在正式 Release 完成后更新；Beta 和 Nightly 索引可以由各自的发布
workflow 更新。索引提交必须与对应的 Release 版本和校验值一致，不能先发布索引
再上传归档。索引经 CDN 分发，分支引用的缓存时间较长且不可控（镜像站通常没有
可用的缓存刷新 API，"发布后主动刷新 CDN"不是可靠步骤）；因此客户端应缓存索引
并按可接受的过期时间重新检查，且不能假设读到的索引一定是最新的——Nightly 依赖
索引中的 `publishedAt` / `buildNumber` 判断新旧，正是为了容忍 CDN 陈旧。

默认访问地址使用 jsDelivr 镜像站（保证中国大陆可访问），按以下顺序回退：

```text
https://cdn.jsdmirror.com/gh/benzBrake/userChrome.js-Loader@main/version.json        # 首选
https://cdn.jsdelivr.net/gh/benzBrake/userChrome.js-Loader@main/version.json         # 回退 1
https://raw.githubusercontent.com/benzBrake/userChrome.js-Loader/main/version.json    # 回退 2
```

`version-beta.json`、`version-nightly.json` 使用同样的域名顺序。`@main`
是索引发布分支，不表示被安装的 Loader 构建来源；实际来源仍以索引中的
`revision` 和下载 URL 为准。客户端应校验索引的 JSON 格式、`product`、
`releaseChannel` 和版本字段。

`version.json` 的内容示例：

```json
{
  "schemaVersion": 1,
  "product": "userChrome.js-Loader",
  "releaseChannel": "stable",
  "version": "3.1.0",
  "revision": "ccbcc9e",
  "publishedAt": "2026-09-21T10:00:00Z",
  "buildNumber": 1,
  "releases": [
    {
      "compatibility": "firefox-136-155",
      "minFirefox": 136,
      "maxFirefox": 155,
      "revision": "ccbcc9e",
      "url": "https://github.com/benzBrake/userChrome.js-Loader/releases/download/v3.1.0/userchromejs-loader-3.1.0-firefox-136-155.zip",
      "manifestUrl": "https://github.com/benzBrake/userChrome.js-Loader/releases/download/v3.1.0/install-manifest-firefox-136-155.json",
      "archiveSha256": "..."
    }
  ]
}
```

`buildNumber` 是单调递增的发布序号，用于 Nightly 新旧判断（Stable/Beta 也可
携带，便于排查 CDN 陈旧索引）。`archiveSha256` 是 ZIP 文件的 SHA-256；它不写入
ZIP 内的
`install-manifest.json`，从而避免哈希自引用。安装清单可以包含各个 Loader 文件
的哈希，但不能用自身内容计算并写回自身。

RunFirefox 的更新流程应为：

1. 获取本地 Firefox 主版本。
2. 从索引中选择匹配的兼容产物；范围按 `minFirefox <= version <= maxFirefox`
   处理，`maxFirefox: null` 表示无上限。兼容范围互不重叠，命中即唯一。
3. 读取 profile 中保存的本地 Loader 版本、兼容范围和 revision。
4. Stable/Beta 只有远端 SemVer 更高才进入更新确认；相同版本但 revision 不同视为
   发布异常。Nightly 必须比较远端 `publishedAt` 或单调递增的 `buildNumber`，不能把
   任意不同 revision 都当作更新，避免 CDN 旧索引导致降级。
5. 通过 RunFirefox 的统一下载模块下载归档。
6. 使用索引中的 `archiveSha256` 校验 ZIP，再校验归档内的安装清单。
7. Firefox 退出后按 manifest 安装文件。

稳定版默认只读取稳定索引；测试选项开启后才读取 Beta 或 Nightly 索引。

## 本地安装状态与回滚

RunFirefox 不应修改 Loader 源文件来写入自身版本。建议在 profile 的 `chrome` 目录中保存：

```text
chrome/.runfirefox-userchromejs.json
```

示例：

```json
{
  "product": "userChrome.js-Loader",
  "version": "3.1.0",
  "revision": "ccbcc9e",
  "compatibility": "firefox-136-155",
  "installedAt": "2026-09-21T10:00:00Z"
}
```

更新前应将 manifest 中声明的旧文件复制到 RunFirefox 管理的备份目录；下载、校验或解压失败时保留旧版本。只有全部文件准备完成后才执行替换，避免产生半安装状态。

## CI 实施建议

现有 nightly workflow 可以保留，并补充以下行为：

- 从 `package.json` 读取 Loader version。
- 在构建目录生成 `install-manifest.json`。
- 将 commit SHA、兼容通道和构建日期写入 manifest，并在 Release 外部生成
  `SHA256SUMS`；ZIP 的哈希同步写入对应版本索引的 `archiveSha256`。
- Nightly 归档使用带日期或 revision 的说明，但可以继续使用可覆盖的 `nightly` Release asset。

新增正式发布 workflow：

1. 由正式 stable tag 触发；Beta 使用独立的 prerelease workflow，不能与 stable
   workflow 共用宽泛的 `v*.*.*` 匹配。
2. 校验 tag 版本与 `package.json.version` 一致，并校验兼容通道配置中的范围
   互不重叠。
3. 对每个兼容通道执行构建和测试。
4. 生成各通道 ZIP、manifest 和 `SHA256SUMS`。
5. 创建 GitHub Release 并上传所有兼容产物和 `SHA256SUMS`。
6. 确认归档已经可下载后，更新仓库中的 `version.json`（Beta/Nightly 更新各自
   索引）并提交；RunFirefox 随后通过 jsDelivr 读取新索引。

正式发布前应至少执行：

```text
npm run check
```

## 版本迁移建议

可以从下一个正式发布版本开始建立体系，不需要重写历史 commit：

1. 在 `package.json` 增加 `version`，首个版本使用 `3.1.0`。
2. 保留现有 `fx_100`、`fx_136-155` 和 `nightly` tag，但将前两个 Release 标记为
   Legacy，不再作为当前版本入口。
3. 增加构建 manifest 生成步骤。
4. 创建 `v3.1.0` 作为第一个正式发行 tag。
5. 让 RunFirefox 先支持仓库中的 `version.json`（以及按需的 Beta/Nightly 索引）和本地安装状态文件。
6. 后续再增加多个 Firefox 兼容通道和回滚 UI。

最终原则是：SemVer 表示 Loader 本身的版本，`firefox-*` 表示 Firefox 兼容范围，commit SHA 表示构建来源，`nightly` 表示滚动开发版本。旧的 `fx_*` tag 仅用于历史链接。RunFirefox 只消费 Release manifest，不直接推断上游版本。
