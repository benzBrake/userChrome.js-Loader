import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(repositoryRoot, "dist");
const packageDirectory = join(distDirectory, "userChrome.js-Loader");

// 兼容范围的唯一来源；发布产物命名、manifest 与版本索引均由此生成。
const COMPAT_CHANNELS = [
  { compatibility: "firefox-136-155", minFirefox: 136, maxFirefox: 155 },
];

const installRoots = ["program", "profile"];

function validateCompatChannels() {
  const sorted = [...COMPAT_CHANNELS].sort((a, b) => a.minFirefox - b.minFirefox);
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.maxFirefox === null || current.minFirefox <= previous.maxFirefox) {
      throw new Error(
        `compat channels must be contiguous and non-overlapping: ${previous.compatibility} vs ${current.compatibility}`,
      );
    }
  }
}

function shortRevision() {
  return execFileSync(
    "git",
    ["rev-parse", "--short", "HEAD"],
    { cwd: repositoryRoot, stdio: ["ignore", "pipe", "inherit"] },
  ).toString().trim();
}

async function listInstallFiles() {
  const sourceRoot = join(repositoryRoot, "src");
  const files = [];
  for (const root of installRoots) {
    const entries = await readdir(join(sourceRoot, root), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      files.push(
        relative(sourceRoot, join(entry.parentPath, entry.name)).split(sep).join("/"),
      );
    }
  }
  return files.sort();
}

validateCompatChannels();

const { version } = JSON.parse(
  await readFile(join(repositoryRoot, "package.json"), "utf8"),
);
const releaseChannel = process.env.RELEASE_CHANNEL ?? "stable";
const revision = shortRevision();

await rm(distDirectory, { force: true, recursive: true });
await mkdir(packageDirectory, { recursive: true });

for (const directory of ["program", "profile", "types"]) {
  await cp(
    join(repositoryRoot, "src", directory),
    join(packageDirectory, directory),
    { recursive: true },
  );
}

for (const file of ["README.md", "LICENSE"]) {
  await cp(join(repositoryRoot, file), join(packageDirectory, file));
}

const files = await listInstallFiles();
const manifests = COMPAT_CHANNELS.map((channel) => ({
  product: "userChrome.js-Loader",
  version,
  revision,
  compatibility: channel.compatibility,
  releaseChannel,
  firefox: {
    min: channel.minFirefox,
    max: channel.maxFirefox,
  },
  builtAt: new Date().toISOString(),
  files,
}));

// 当前所有通道共享同一份代码；出现多通道时需按通道拆分打包目录，
// 归档内的 install-manifest.json 不能再共用首个通道的清单。
if (COMPAT_CHANNELS.length !== 1) {
  throw new Error("per-channel packaging is not implemented yet");
}

const json = JSON.stringify(manifests[0], null, 2) + "\n";
await writeFile(join(packageDirectory, "install-manifest.json"), json);

for (const manifest of manifests) {
  await writeFile(
    join(distDirectory, `install-manifest-${manifest.compatibility}.json`),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
