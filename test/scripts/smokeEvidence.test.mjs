import assert from "node:assert/strict";
import test from "node:test";

import {
  parseInstalledExtensionListing,
  validateContractFakeLog,
  validateHarnessEvidence,
} from "../../scripts/lib/smoke-evidence.mjs";

test("extension listing parsing is case-insensitive and ignores blank lines", () => {
  assert.deepEqual(
    parseInstalledExtensionListing("Undefined_Publisher.EmuSA80535-DAP@0.1.0\r\n\r\n"),
    ["undefined_publisher.emusa80535-dap@0.1.0"],
  );
});

test("contract fake log requires exact Slice-1 launch and disconnect sequence", () => {
  const text = [
    { command: "hello", arguments: { protocol: { major: 1, minor: 0 } } },
    {
      command: "load",
      arguments: { format: "raw-code-64k", expectedSha256: "a".repeat(64) },
    },
    { command: "reset", arguments: { seed: 525109, entryAddress: 0 } },
    { command: "replaceCodeBreakpoints", arguments: { addresses: [] } },
    { command: "terminate", arguments: {} },
  ]
    .map((record) => JSON.stringify(record))
    .join("\n");
  assert.deepEqual(validateContractFakeLog(text), [
    "hello",
    "load",
    "reset",
    "replaceCodeBreakpoints",
    "terminate",
  ]);
  assert.throws(() => validateContractFakeLog(text.replace("terminate", "run")), /sequence/);
});

test("harness evidence requires installed identity, DAP entry, disconnect and termination", () => {
  const evidence = {
    extensionId: "undefined_publisher.emusa80535-dap",
    extensionVersion: "0.1.0",
    dapRequests: ["initialize", "launch", "configurationDone", "disconnect"],
    dapEvents: ["initialized", "stopped", "terminated"],
  };
  assert.doesNotThrow(() =>
    validateHarnessEvidence(
      evidence,
      "undefined_publisher.emusa80535-dap",
      "0.1.0",
    ),
  );
  assert.throws(
    () => validateHarnessEvidence({ ...evidence, dapEvents: [] }, evidence.extensionId, "0.1.0"),
    /entry stop/,
  );
});
