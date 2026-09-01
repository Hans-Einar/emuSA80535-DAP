import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { clearTimeout, setTimeout } from "node:timers";

import { killProcessTree, runBounded } from "../../scripts/lib/process-control.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..");

test(
  "Windows test launcher preserves independent contract-fake stdin/stdout/stderr pipes",
  { skip: process.platform !== "win32", timeout: 30_000 },
  async () => {
    const temporaryParent = await fs.realpath(os.tmpdir());
    const temporaryRoot = await fs.mkdtemp(
      path.join(temporaryParent, "emusa80535-wrapper-test-"),
    );
    const relative = path.relative(temporaryParent, temporaryRoot);
    assert.ok(
      relative.length > 0 &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative) &&
        path.basename(temporaryRoot).startsWith("emusa80535-wrapper-test-"),
    );
    let child;
    try {
      const executablePath = path.join(temporaryRoot, "emu-debug-smoke.exe");
      const compilerPath = path.join(
        process.env.WINDIR ?? "C:\\Windows",
        "Microsoft.NET",
        "Framework64",
        "v4.0.30319",
        "csc.exe",
      );
      await runBounded(
        compilerPath,
        [
          "/nologo",
          "/target:exe",
          `/out:${executablePath}`,
          path.join(repositoryRoot, "test", "packaged-smoke", "fake-launcher.cs"),
        ],
        { timeoutMs: 20_000 },
      );

      child = spawn(executablePath, ["--headless-debug"], {
        env: {
          ...process.env,
          EMU_SMOKE_NODE: process.execPath,
          EMU_SMOKE_SERVER: path.join(
            repositoryRoot,
            "out",
            "test-fixtures",
            "fake-emulator",
            "server.js",
          ),
        },
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      child.stdin.write(
        `${JSON.stringify({
          type: "request",
          id: 1,
          command: "hello",
          arguments: {
            protocol: { major: 1, minor: 0 },
            requiredCapabilities: [
              "rawCode64k",
              "deterministicReset",
              "snapshotBasicRegisters",
              "decodeCode",
              "replaceCodeBreakpoints",
              "boundedRun",
              "stepInstruction",
            ],
          },
        })}\n`,
      );
      const response = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("wrapper hello timeout")), 5_000);
        child.stdout.once("data", (chunk) => {
          clearTimeout(timer);
          resolve(JSON.parse(chunk.toString("utf8")));
        });
      });
      assert.equal(response.command, "hello");
      assert.equal(response.success, true);
      child.stdin.write(
        `${JSON.stringify({ type: "request", id: 2, command: "terminate" })}\n`,
      );
      const exitCode = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("wrapper exit timeout")), 5_000);
        child.once("exit", (code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      assert.equal(exitCode, 0);
    } finally {
      if (child?.pid !== undefined && child.exitCode === null) {
        await killProcessTree(child.pid);
      }
      await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
