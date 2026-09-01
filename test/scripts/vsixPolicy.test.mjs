import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPECTED_VSIX_ENTRIES,
  validateVsixEntries,
} from "../../scripts/lib/vsix-policy.mjs";

test("VSIX policy accepts the exact package allowlist", () => {
  assert.equal(
    validateVsixEntries(EXPECTED_VSIX_ENTRIES),
    EXPECTED_VSIX_ENTRIES.length,
  );
});

test("VSIX policy rejects fake, fixture, executable, and other additions", () => {
  for (const unexpected of [
    "extension/test-fixtures/fake-emulator/server.js",
    "extension/test-fixtures/firmware/synthetic-loop.bin",
    "extension/emu-debug.exe",
    "extension/scripts/smoke-packaged-extension.mjs",
  ]) {
    assert.throws(
      () => validateVsixEntries([...EXPECTED_VSIX_ENTRIES, unexpected]),
      /unexpected:/,
    );
  }
});

test("VSIX policy rejects missing, duplicate, and unsafe entries", () => {
  assert.throws(
    () => validateVsixEntries(EXPECTED_VSIX_ENTRIES.slice(1)),
    /missing:/,
  );
  assert.throws(
    () =>
      validateVsixEntries([
        ...EXPECTED_VSIX_ENTRIES,
        EXPECTED_VSIX_ENTRIES[0],
      ]),
    /duplicate/,
  );
  assert.throws(
    () => validateVsixEntries([...EXPECTED_VSIX_ENTRIES, "../escape"]),
    /unsafe/,
  );
});
