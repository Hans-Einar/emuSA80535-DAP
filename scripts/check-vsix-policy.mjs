import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  readVsixEntries,
  validateVsixEntries,
} from "./lib/vsix-policy.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageManifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const vsixPath = path.resolve(
  process.argv[2] ??
    path.join(
      repositoryRoot,
      "dist",
      `${packageManifest.name}-${packageManifest.version}.vsix`,
    ),
);

if (!fs.statSync(vsixPath).isFile()) {
  throw new Error(`VSIX is not a regular file: ${vsixPath}`);
}
const entries = await readVsixEntries(vsixPath);
const count = validateVsixEntries(entries);
process.stdout.write(`VSIX policy PASS: ${count} exact allowlisted entries in ${vsixPath}\n`);
