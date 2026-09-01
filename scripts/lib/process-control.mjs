import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";

const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;

function appendBounded(chunks, chunk, byteState) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  byteState.total += buffer.length;
  if (byteState.total <= MAX_CAPTURE_BYTES) {
    chunks.push(buffer);
  }
}

export async function killProcessTree(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return;
  }
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn(
        path.join(process.env.WINDIR ?? "C:\\Windows", "System32", "taskkill.exe"),
        ["/F", "/T", "/PID", String(pid)],
        { stdio: "ignore", windowsHide: true },
      );
      killer.on("error", () => resolve());
      killer.on("close", () => resolve());
    });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The process has already exited.
    }
  }
}

export function runBounded(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive integer");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });
    const stdout = [];
    const stderr = [];
    const stdoutBytes = { total: 0 };
    const stderrBytes = { total: 0 };
    child.stdout?.on("data", (chunk) => appendBounded(stdout, chunk, stdoutBytes));
    child.stderr?.on("data", (chunk) => appendBounded(stderr, chunk, stderrBytes));

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      void killProcessTree(child.pid).finally(() => {
        reject(new Error(`${command} exceeded ${timeoutMs} ms and its process tree was killed`));
      });
    }, timeoutMs);

    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      const result = {
        code,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) {
        resolve(result);
        return;
      }
      reject(
        new Error(
          `${command} exited with ${String(code ?? signal)}\n${result.stderr}${result.stdout}`,
        ),
      );
    });
  });
}

export function commandLineMatches(commandLine, needles) {
  const normalized = commandLine.toLowerCase().replaceAll("\\", "/");
  return needles.some((needle) =>
    normalized.includes(needle.toLowerCase().replaceAll("\\", "/")),
  );
}

async function linuxProcesses() {
  const entries = await fs.readdir("/proc", { withFileTypes: true });
  const processes = [];
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map(async (entry) => {
        try {
          const commandLine = await fs.readFile(`/proc/${entry.name}/cmdline`, "utf8");
          processes.push({
            pid: Number.parseInt(entry.name, 10),
            commandLine: commandLine.replaceAll("\0", " ").trim(),
          });
        } catch {
          // Processes can disappear during the bounded scan.
        }
      }),
  );
  return processes;
}

async function windowsProcesses() {
  const powershell = process.env.PWSH_PATH ?? "pwsh.exe";
  const script = [
    "$ErrorActionPreference='Stop'",
    "@(Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress",
  ].join("; ");
  const result = await runBounded(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    { timeoutMs: 20_000 },
  );
  const parsed = JSON.parse(result.stdout);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((row) => ({
    pid: row.ProcessId,
    commandLine: typeof row.CommandLine === "string" ? row.CommandLine : "",
  }));
}

export async function findMatchingProcesses(needles) {
  if (needles.length === 0) {
    return [];
  }
  const processes =
    process.platform === "win32" ? await windowsProcesses() : await linuxProcesses();
  return processes.filter(
    (candidate) =>
      candidate.pid !== process.pid &&
      commandLineMatches(candidate.commandLine, needles),
  );
}

export async function waitForNoMatchingProcesses(
  needles,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const matches = await findMatchingProcesses(needles);
    if (matches.length === 0) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `orphan process detected: ${matches
          .map((candidate) => `${candidate.pid} ${candidate.commandLine}`)
          .join(" | ")}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
