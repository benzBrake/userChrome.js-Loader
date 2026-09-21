import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(repositoryRoot, "dist");

const releaseChannel = process.env.RELEASE_CHANNEL ?? "stable";
const indexFileName =
  releaseChannel === "stable" ? "version.json" : `version-${releaseChannel}.json`;
const tag = process.env.RELEASE_TAG;
const tagSha = process.env.RELEASE_TAG_SHA;
if (!tag || !tagSha) {
  throw new Error("RELEASE_TAG and RELEASE_TAG_SHA must be set");
}

function shortRevision(sha) {
  return execFileSync(
    "git",
    ["rev-parse", "--short", sha],
    { cwd: repositoryRoot, stdio: ["ignore", "pipe", "inherit"] },
  ).toString().trim();
}

async function sha256(path) {
  const digest = createHash("sha256");
  digest.update(await readFile(path));
  return digest.digest("hex");
}

const { version } = JSON.parse(
  await readFile(join(repositoryRoot, "package.json"), "utf8"),
);
if (tag !== `v${version}`) {
  throw new Error(`tag ${tag} does not match package.json version ${version}`);
}

let buildNumber = 1;
try {
  const previous = JSON.parse(
    await readFile(join(repositoryRoot, indexFileName), "utf8"),
  );
  if (typeof previous.buildNumber === "number") {
    buildNumber = previous.buildNumber + 1;
  }
} catch {
  // 首次发布，仓库中尚无索引。
}

const repository = process.env.GITHUB_REPOSITORY;
const assetsBase = `https://github.com/${repository}/releases/download/${tag}`;

const releases = [];
for (const entry of await readdir(distDirectory)) {
  const match = entry.match(/^install-manifest-(firefox-[\d-]+)\.json$/);
  if (!match) continue;
  const manifest = JSON.parse(
    await readFile(join(distDirectory, entry), "utf8"),
  );
  const archiveName = `userchromejs-loader-${version}-${match[1]}.zip`;
  const archivePath = join(distDirectory, archiveName);
  if (!(await stat(archivePath)).isFile()) {
    throw new Error(`missing archive for ${match[1]}: ${archiveName}`);
  }
  releases.push({
    compatibility: match[1],
    minFirefox: manifest.firefox.min,
    maxFirefox: manifest.firefox.max,
    revision: manifest.revision,
    url: `${assetsBase}/${archiveName}`,
    manifestUrl: `${assetsBase}/${entry}`,
    archiveSha256: await sha256(archivePath),
  });
}
if (releases.length === 0) {
  throw new Error("no compat manifests found in dist/");
}

const index = {
  schemaVersion: 1,
  product: "userChrome.js-Loader",
  releaseChannel,
  version,
  revision: shortRevision(tagSha),
  publishedAt: new Date().toISOString(),
  buildNumber,
  releases,
};

await writeFile(
  join(repositoryRoot, indexFileName),
  JSON.stringify(index, null, 2) + "\n",
);
