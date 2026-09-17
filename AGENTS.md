# 项目协作约定

## 指令优先级

- 开始工作前，先检查仓库根目录是否存在 `AGENTS.local.md`。
- `AGENTS.local.md` 用于记录仅适用于当前设备或当前开发者环境的配置，其指令优先于本文件。
- 当两者存在冲突时遵循 `AGENTS.local.md`；未被覆盖的约定继续遵循本文件。
- 不要提交 `AGENTS.local.md`，也不要把其中的本机路径、端口、配置文件或其他环境信息复制到受版本控制的文件中。

## Firefox 调试

- 使用 `debugging-firefox` skill 调试 Firefox 浏览器界面、扩展或 userChrome 脚本。
- 本文件只定义与具体环境无关的调试流程。Firefox 可执行文件、RDP 端口、配置文件目录等本机参数应由用户在任务中指定，或写入 `AGENTS.local.md`。
- 不硬编码 Firefox 安装路径、调试端口、用户配置目录、代理地址或进程 ID。
- 未指定端口时，先检查 `AGENTS.local.md`；仍无法确定时，应向用户确认或选择一个当前空闲的高位端口，并在执行前明确告知。
- RDP 连接仅使用回环地址 `127.0.0.1`。启动监听前检查目标端口占用情况，禁止连接或监听非回环地址。
- 启动调试服务时，参数形式为 `--start-debugger-server <PORT>`，并传给实际的 Firefox 浏览器可执行文件，而不是便携版或第三方启动器。
- 优先连接用户已启动且已授权调试的 Firefox 实例。不得擅自终止、重启或修改现有 Firefox 实例及其配置；确需重启时先取得用户明确同意。
- 首次连接可能触发 Firefox 的远程调试授权提示，应由用户在浏览器中确认，不得绕过或自动接受。
- 任务完成后关闭本次创建的调试客户端，并报告仍在运行的 Firefox 进程或监听端口。关闭客户端不代表调试监听已经关闭。

## 本地覆盖文件示例

`AGENTS.local.md` 可记录如下内容，但不要将具体值写入本文件：

```markdown
# 本地环境

- Firefox 可执行文件：`<absolute-path-to-firefox>`
- Firefox RDP 端口：`<port>`
- Firefox 配置文件：`<profile-path-or-identifier>`
```
