import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canarySource = join(repositoryRoot, "tests", "fixtures", "compat", "CompatCanary.uc.js");
const markerName = "compat-test-marker.json";

const usage = `用法: node scripts/compat-test.mjs --firefox <firefox 可执行文件> [选项]

选项:
  --firefox <path>      Firefox 可执行文件路径（必需；必须是可写入的独立安装，勿指向日常实例）
  --package-dir <dir>   待安装的 loader 包目录（默认 dist/userChrome.js-Loader）
  --label <version>     版本标签，用于结果报告（默认取 Firefox 实际版本）
  --timeout-ms <n>      等待标记文件的超时（默认 60000）
  --keep-profile        保留测试 profile 与日志，便于诊断
  --headless            以 --headless 启动 Firefox（默认假设外部已提供显示，如 xvfb-run）`;

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function parseArgsOrExit() {
  const { values } = parseArgs({
    options: {
      firefox: { type: "string" },
      "package-dir": { type: "string", default: join(repositoryRoot, "dist", "userChrome.js-Loader") },
      label: { type: "string" },
      "timeout-ms": { type: "string", default: "60000" },
      "keep-profile": { type: "boolean", default: false },
      headless: { type: "boolean", default: false },
    },
  });
  if (!values.firefox || !Number.isFinite(Number.parseInt(values["timeout-ms"], 10)) || Number.parseInt(values["timeout-ms"], 10) <= 0) {
    console.error(usage);
    process.exit(1);
  }
  return {
    firefoxPath: values.firefox,
    packageDir: resolve(values["package-dir"]),
    label: values.label,
    timeoutMs: Number.parseInt(values["timeout-ms"], 10),
    keepProfile: values["keep-profile"],
    headless: values.headless,
  };
}

function versionFromApplicationIni(appDir) {
  const iniPath = join(appDir, "application.ini");
  if (!existsSync(iniPath)) return null;
  let inAppSection = false;
  for (const line of readFileSync(iniPath, "utf8").split(/\r?\n/)) {
    if (line.startsWith("[")) {
      inAppSection = line.trim() === "[App]";
      continue;
    }
    if (inAppSection && line.startsWith("Version=")) return line.slice("Version=".length).trim();
  }
  return null;
}

// Windows 上 firefox.exe --version 不写 stdout，回退到安装目录的 application.ini
function detectFirefoxVersion(firefoxPath, appDir) {
  const probed = spawnSync(firefoxPath, ["--version"], { encoding: "utf8", timeout: 15000 });
  const output = `${probed.stdout ?? ""}${probed.stderr ?? ""}`;
  const fromCli = output.match(/(\d+(?:\.\d+)*)/);
  return fromCli?.[1] ?? versionFromApplicationIni(appDir);
}

async function installProgramFiles(packageDir, appDir) {
  const pairs = [
    [join(packageDir, "program", "config.js"), join(appDir, "config.js")],
    [
      join(packageDir, "program", "defaults", "pref", "config-prefs.js"),
      join(appDir, "defaults", "pref", "config-prefs.js"),
    ],
  ];
  for (const [source, target] of pairs) {
    const content = await readFile(source, "utf8");
    if (existsSync(target)) {
      const existing = await readFile(target, "utf8");
      if (existing === content) {
        console.log(`已安装（跳过）: ${target}`);
        continue;
      }
      throw new Error(`${target} 已存在且内容不同，拒绝覆盖既有安装；请使用干净的 Firefox 实例`);
    }
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    console.log(`已安装: ${target}`);
  }
}

async function stopFirefox(child, profileToken) {
  // 1) 结束自己 spawn 的进程（Windows 上它可能只是启动器）
  if (child.exitCode === null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  // 2) 按命令行中的 profile 标记结束真正的浏览器进程树（含内容进程）。
  //    Windows 上 firefox.exe 可能只是启动器，浏览器运行在独立进程树中；
  //    残留的内容进程会持有 stdio 管道句柄，导致 Node 无法退出。
  if (process.platform === "win32") {
    spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | Where-Object { $_.CommandLine -like '*${profileToken}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
      ],
      { stdio: "ignore" },
    );
  } else {
    spawnSync("pkill", ["-f", profileToken], { stdio: "ignore" });
  }
  // 3) 兜底：确保 spawn 的子进程退出
  if (child.exitCode === null) {
    const exited = new Promise((resolveExit) => {
      child.once("exit", () => resolveExit());
    });
    await Promise.race([exited, sleep(5000)]);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }
}

async function waitForMarker(markerPath, timeoutMs, firefox, spawnError) {
  const readMarker = async () => {
    if (!existsSync(markerPath)) return null;
    try {
      return JSON.parse(await readFile(markerPath, "utf8"));
    } catch {
      // 文件可能仍在写入，下轮重读
      return null;
    }
  };
  const deadline = Date.now() + timeoutMs;
  let exitedAt = null;
  while (Date.now() < deadline) {
    const marker = await readMarker();
    if (marker) return marker;
    if (spawnError.message) {
      throw new Error(`无法启动 Firefox: ${spawnError.message}`);
    }
    // Windows 上 firefox.exe 可能只是启动器：它退出（exit 0）后浏览器仍在
    // 独立进程树中运行，因此以标记文件为唯一成功依据，进程退出后宽限一段时间
    if (firefox.exitCode !== null && exitedAt === null) {
      exitedAt = Date.now();
      console.warn(`警告: Firefox 启动进程已退出（exit code ${firefox.exitCode}），继续等待标记文件…`);
    }
    if (exitedAt !== null && Date.now() - exitedAt > 15000) {
      throw new Error(`Firefox 进程退出（exit code ${firefox.exitCode}）后 15 秒内未出现标记文件`);
    }
    await sleep(500);
  }
  throw new Error(`在 ${timeoutMs}ms 内未出现标记文件 ${markerPath}`);
}

function printLogTail(logText, maxLines = 80) {
  const lines = logText.split(/\r?\n/);
  const tail = lines.slice(-maxLines).join("\n");
  console.error(`--- Firefox 输出日志（最后 ${Math.min(lines.length, maxLines)} 行） ---\n${tail}`);
}

async function main() {
  const options = parseArgsOrExit();

  if (!existsSync(options.firefoxPath)) {
    throw new Error(`Firefox 可执行文件不存在: ${options.firefoxPath}`);
  }
  const manifestPath = join(options.packageDir, "install-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`找不到 ${manifestPath}；请先运行 npm run build 或用 --package-dir 指定包目录`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!existsSync(canarySource)) {
    throw new Error(`找不到金丝雀脚本: ${canarySource}`);
  }

  const appDir = dirname(realpathSync(options.firefoxPath));
  if (!existsSync(join(appDir, "application.ini"))) {
    throw new Error(`${appDir} 下没有 application.ini，无法确认 Firefox 安装目录`);
  }

  const firefoxVersion = detectFirefoxVersion(options.firefoxPath, appDir);
  if (!firefoxVersion) {
    throw new Error("无法探测 Firefox 版本（--version 与 application.ini 均失败）");
  }
  const label = options.label ?? firefoxVersion;
  const major = Number.parseInt(firefoxVersion, 10);
  const { min, max } = manifest.firefox;
  const inRange = major >= min && major <= max;
  console.log(`Firefox 实际版本: ${firefoxVersion}（标签: ${label}）`);
  console.log(
    inRange
      ? `兼容性声明范围: Firefox ${min}–${max}，当前版本在范围内`
      : `兼容性声明范围: Firefox ${min}–${max}，当前版本超出范围（前瞻测试，结果仅作参考信号）`,
  );

  await installProgramFiles(options.packageDir, appDir);

  const profileDir = await mkdtemp(join(tmpdir(), "ucjs-compat-"));
  const logPath = join(tmpdir(), `${basename(profileDir)}.log`);
  const markerPath = join(profileDir, "chrome", markerName);
  console.log(`测试 profile: ${profileDir}`);

  await cp(join(options.packageDir, "profile", "chrome"), join(profileDir, "chrome"), { recursive: true });
  await cp(canarySource, join(profileDir, "chrome", basename(canarySource)));
  await writeFile(
    join(profileDir, "user.js"),
    [
      "// 由 scripts/compat-test.mjs 生成",
      'user_pref("devtools.console.stdout.chrome", true);',
      'user_pref("browser.shell.checkDefaultBrowser", false);',
      "",
    ].join("\n"),
  );

  const firefoxArgs = ["-profile", profileDir, "-no-remote"];
  if (options.headless) firefoxArgs.push("--headless");
  firefoxArgs.push("about:blank");

  const logChunks = [];
  const appendLog = (origin, chunk) => {
    const text = `[${origin}] ${chunk}`;
    logChunks.push(text);
    process.stdout.write(text);
  };
  const spawnError = { message: "" };
  const firefox = spawn(options.firefoxPath, firefoxArgs, { stdio: ["ignore", "pipe", "pipe"] });
  firefox.stdout.on("data", (chunk) => appendLog("stdout", chunk));
  firefox.stderr.on("data", (chunk) => appendLog("stderr", chunk));
  firefox.on("error", (error) => {
    spawnError.message = error.message;
  });

  try {
    const marker = await waitForMarker(markerPath, options.timeoutMs, firefox, spawnError);
    console.log(`\n标记文件内容: ${JSON.stringify(marker, null, 2)}`);

    if (marker.marker !== "userchromejs-compat-test") {
      throw new Error("标记文件内容不是本测试的金丝雀脚本所写");
    }
    if (marker.hasLoaderGlobal !== true) {
      throw new Error("窗口缺少 userChrome_js 全局对象，loader 未正确注入");
    }
    if (marker.version !== label) {
      console.warn(`警告: 标记文件版本 ${marker.version} 与标签 ${label} 不一致`);
    }

    const logText = logChunks.join("");
    const loaderLines = logText.split(/\r?\n/).filter((line) => line.includes("userChrome.js"));
    if (loaderLines.length > 0) {
      console.log(`\nloader 日志佐证（${loaderLines.length} 行）:`);
      for (const line of loaderLines.slice(0, 10)) console.log(`  ${line}`);
    } else {
      console.warn("警告: stdout/stderr 中未发现 userChrome.js 前缀日志（仅诊断信息，不影响判定）");
    }

    console.log(`\nPASS — Firefox ${firefoxVersion} 上 loader 端到端加载成功（脚本数: ${marker.scriptCount ?? "未知"}）`);
  } catch (error) {
    printLogTail(logChunks.join(""));
    throw error;
  } finally {
    await writeFile(logPath, logChunks.join(""), { force: true }).catch(() => {});
    await stopFirefox(firefox, basename(profileDir));
    // Firefox 内容进程可能继承了 stdio 管道；销毁流确保 Node 不会因残留句柄挂起
    firefox.stdout?.destroy();
    firefox.stderr?.destroy();
    if (!options.keepProfile) {
      await rm(profileDir, { force: true, recursive: true }).catch(() => {});
    }
  }
  if (!options.keepProfile) {
    await rm(logPath, { force: true }).catch(() => {});
  } else {
    console.log(`已保留诊断文件: ${logPath}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`error: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
}
