import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = join(repositoryRoot, "dist");
const packageDirectory = join(distDirectory, "userChrome.js-Loader");

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
