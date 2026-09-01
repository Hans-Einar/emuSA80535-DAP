"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vscode = require("vscode");

const DEBUG_TYPE = "emuSA80535";

function requiredEnvironment(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  return value;
}

function withTimeout(promise, label, timeoutMs = 20_000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs} ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function canonical(value) {
  const resolved = fs.realpathSync.native(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

async function run() {
  const expectedId = requiredEnvironment("EMU_SMOKE_EXTENSION_ID");
  const expectedVersion = requiredEnvironment("EMU_SMOKE_EXTENSION_VERSION");
  const expectedRoot = requiredEnvironment("EMU_SMOKE_INSTALLED_ROOT");
  const program = requiredEnvironment("EMU_SMOKE_FIRMWARE");
  const emulatorPath = requiredEnvironment("EMU_SMOKE_EMULATOR");
  const resultPath = requiredEnvironment("EMU_SMOKE_RESULT_FILE");

  const extension = vscode.extensions.getExtension(expectedId);
  assert.ok(extension, `installed extension ${expectedId} was not discovered`);
  assert.equal(extension.packageJSON.version, expectedVersion);
  assert.equal(extension.packageJSON.name, "emuSA80535-dap");
  assert.equal(canonical(extension.extensionPath), canonical(expectedRoot));
  await extension.activate();

  const dapRequests = [];
  const dapResponses = [];
  const dapEvents = [];
  let session;
  let resolveStopped;
  let rejectStopped;
  const stopped = new Promise((resolve, reject) => {
    resolveStopped = resolve;
    rejectStopped = reject;
  });
  let resolveTerminated;
  const terminated = new Promise((resolve) => {
    resolveTerminated = resolve;
  });

  const disposables = [
    vscode.debug.onDidStartDebugSession((candidate) => {
      if (candidate.type === DEBUG_TYPE) {
        session = candidate;
      }
    }),
    vscode.debug.onDidTerminateDebugSession((candidate) => {
      if (candidate.type === DEBUG_TYPE) {
        resolveTerminated();
      }
    }),
    vscode.debug.registerDebugAdapterTrackerFactory(DEBUG_TYPE, {
      createDebugAdapterTracker() {
        return {
          onWillReceiveMessage(message) {
            if (message.type === "request") {
              dapRequests.push(message.command);
            }
          },
          onDidSendMessage(message) {
            if (message.type === "response") {
              dapResponses.push({ command: message.command, success: message.success });
            } else if (message.type === "event") {
              dapEvents.push({ event: message.event, body: message.body });
              if (message.event === "stopped") {
                if (message.body?.reason === "entry" && message.body?.threadId === 1) {
                  resolveStopped(message);
                } else {
                  rejectStopped(new Error(`unexpected stopped event: ${JSON.stringify(message)}`));
                }
              }
            }
          },
          onError(error) {
            rejectStopped(error);
          },
          onExit(code, signal) {
            if (code !== 0 && code !== undefined) {
              rejectStopped(new Error(`adapter exited early: ${String(code ?? signal)}`));
            }
          },
        };
      },
    }),
  ];

  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, "smoke workspace was not opened");
    const started = await withTimeout(
      vscode.debug.startDebugging(workspaceFolder, {
        type: DEBUG_TYPE,
        request: "launch",
        name: "Packaged Slice-1 smoke",
        program,
        emulatorPath,
        entryAddress: "0x0000",
        resetSeed: 525109,
        stopOnEntry: true,
        trace: "off",
      }),
      "debug start",
    );
    assert.equal(started, true, "VS Code rejected the debug configuration");
    await withTimeout(stopped, "entry stop");
    assert.ok(session, "VS Code did not publish the debug session");
    assert.ok(dapRequests.includes("initialize"));
    assert.ok(dapRequests.includes("launch"));
    assert.ok(dapRequests.includes("configurationDone"));
    assert.ok(dapResponses.some((response) => response.command === "launch" && response.success));

    const stoppedSession = session;
    await withTimeout(
      vscode.debug.stopDebugging(stoppedSession),
      "debug stop",
    );
    await withTimeout(terminated, "debug session termination");
    assert.ok(dapRequests.includes("disconnect"));
    assert.equal(
      dapEvents.filter((event) => event.event === "terminated").length,
      1,
      "adapter must emit exactly one terminated event",
    );

    fs.writeFileSync(
      resultPath,
      `${JSON.stringify({
        extensionId: extension.id,
        extensionVersion: extension.packageJSON.version,
        extensionPath: extension.extensionPath,
        dapRequests,
        dapResponses,
        dapEvents: dapEvents.map((event) => event.event),
      })}\n`,
      "utf8",
    );
  } finally {
    if (session !== undefined && vscode.debug.activeDebugSession === session) {
      await vscode.debug.stopDebugging(session);
    }
    for (const disposable of disposables) {
      disposable.dispose();
    }
  }
}

module.exports = { run };
