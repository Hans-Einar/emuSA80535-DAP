import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import {
  commandLineMatches,
  runBounded,
} from "../../scripts/lib/process-control.mjs";

test("process matching normalizes Windows and POSIX paths", () => {
  assert.equal(
    commandLineMatches(
      "Code.exe C:\\isolated\\extension\\out\\adapter\\src\\main.js",
      ["C:/isolated/extension/out/adapter/src/main.js"],
    ),
    true,
  );
  assert.equal(commandLineMatches("node unrelated.js", ["fake/server.cjs"]), false);
});

test("bounded runner captures a successful child", async () => {
  const result = await runBounded(
    process.execPath,
    ["-e", "process.stdout.write('ok')"],
    { timeoutMs: 5_000 },
  );
  assert.equal(result.stdout, "ok");
});

test("bounded runner kills a timed-out process tree", async () => {
  await assert.rejects(
    runBounded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      timeoutMs: 100,
    }),
    /process tree was killed/,
  );
});
