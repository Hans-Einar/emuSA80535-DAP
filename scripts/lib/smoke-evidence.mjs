import fs from "node:fs/promises";
import path from "node:path";

export function parseInstalledExtensionListing(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0);
}

export function validateContractFakeLog(text) {
  const records = text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
  const commands = records.map((record) => record.command);
  const expected = [
    "hello",
    "load",
    "reset",
    "replaceCodeBreakpoints",
    "terminate",
  ];
  if (JSON.stringify(commands) !== JSON.stringify(expected)) {
    throw new Error(
      `contract fake command sequence ${JSON.stringify(commands)} did not equal ${JSON.stringify(expected)}`,
    );
  }
  if (
    records[0]?.arguments?.protocol?.major !== 1 ||
    records[0]?.arguments?.protocol?.minor !== 0
  ) {
    throw new Error("packaged smoke did not request emu-debug protocol 1.0");
  }
  if (
    records[1]?.arguments?.format !== "raw-code-64k" ||
    typeof records[1]?.arguments?.expectedSha256 !== "string"
  ) {
    throw new Error("packaged smoke did not use the frozen raw-code-64k load contract");
  }
  if (
    !Array.isArray(records[3]?.arguments?.addresses) ||
    records[3].arguments.addresses.length !== 0
  ) {
    throw new Error("packaged smoke did not use replace-all breakpoint initialization");
  }
  return commands;
}

export async function findInstalledExtension(
  extensionsDirectory,
  expectedName,
  expectedVersion,
) {
  const directoryEntries = await fs.readdir(extensionsDirectory, {
    withFileTypes: true,
  });
  const matches = [];
  for (const directoryEntry of directoryEntries) {
    if (!directoryEntry.isDirectory()) {
      continue;
    }
    const extensionRoot = path.join(extensionsDirectory, directoryEntry.name);
    try {
      const manifest = JSON.parse(
        await fs.readFile(path.join(extensionRoot, "package.json"), "utf8"),
      );
      if (manifest.name === expectedName && manifest.version === expectedVersion) {
        matches.push({ extensionRoot, manifest });
      }
    } catch {
      // Ignore editor metadata and unrelated directory entries.
    }
  }
  if (matches.length !== 1) {
    throw new Error(
      `expected one installed ${expectedName}@${expectedVersion}, found ${matches.length}`,
    );
  }
  return matches[0];
}

export function validateHarnessEvidence(
  evidence,
  expectedId,
  expectedVersion,
) {
  if (
    evidence.extensionId.toLowerCase() !== expectedId.toLowerCase() ||
    evidence.extensionVersion !== expectedVersion
  ) {
    throw new Error("extension-host evidence has the wrong extension identity");
  }
  for (const command of ["initialize", "launch", "configurationDone", "disconnect"]) {
    if (!evidence.dapRequests.includes(command)) {
      throw new Error(`extension-host evidence is missing DAP ${command}`);
    }
  }
  if (!evidence.dapEvents.includes("stopped")) {
    throw new Error("extension-host evidence is missing the entry stop");
  }
  if (evidence.dapEvents.filter((event) => event === "terminated").length !== 1) {
    throw new Error("extension-host evidence must contain exactly one terminated event");
  }
}
