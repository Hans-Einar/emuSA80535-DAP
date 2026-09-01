import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { runBounded } from "./lib/process-control.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryParent = await fs.realpath(os.tmpdir());
const smokeRoot = await fs.mkdtemp(
  path.join(temporaryParent, "emusa80535-packaged-smoke-"),
);

function safeTemporaryRoot(candidate) {
  const relative = path.relative(temporaryParent, candidate);
  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    path.basename(candidate).startsWith("emusa80535-packaged-smoke-")
  );
}

if (!safeTemporaryRoot(smokeRoot)) {
  throw new Error(`refusing to use unsafe smoke directory: ${smokeRoot}`);
}

try {
  await runBounded(
    process.execPath,
    [path.join(repositoryRoot, "scripts", "run-packaged-smoke-worker.mjs")],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        EMU_SMOKE_TEMP_ROOT: smokeRoot,
        EMU_SMOKE_VSCODE_VERSION: "1.95.0",
      },
      timeoutMs: 10 * 60_000,
      inherit: true,
    },
  );
} finally {
  await fs.rm(smokeRoot, { recursive: true, force: true, maxRetries: 3 });
}
