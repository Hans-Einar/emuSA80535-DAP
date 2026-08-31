import * as vscode from "vscode";

import { createAdapterExecutableSpec } from "./adapterExecutable";
import { applyWorkspaceEmulatorPath } from "./configuration";

const DEBUG_TYPE = "emuSA80535";

class EmuConfigurationProvider implements vscode.DebugConfigurationProvider {
  public resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    debugConfiguration: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (
      debugConfiguration.request !== undefined &&
      debugConfiguration.request !== "launch"
    ) {
      return undefined;
    }

    const workspacePath = vscode.workspace
      .getConfiguration("emuSA80535", folder?.uri)
      .get<unknown>("emulatorPath");

    return applyWorkspaceEmulatorPath(debugConfiguration, workspacePath);
  }
}

class EmuAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  public constructor(private readonly extensionRoot: string) {}

  public createDebugAdapterDescriptor(): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    const executable = createAdapterExecutableSpec(
      this.extensionRoot,
      process.execPath,
      process.env,
    );

    return new vscode.DebugAdapterExecutable(
      executable.command,
      executable.args,
      {
        cwd: executable.cwd,
        env: executable.env,
      },
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      DEBUG_TYPE,
      new EmuConfigurationProvider(),
    ),
    vscode.debug.registerDebugAdapterDescriptorFactory(
      DEBUG_TYPE,
      new EmuAdapterDescriptorFactory(context.extensionPath),
    ),
  );
}

export function deactivate(): void {
  // VS Code owns the adapter process; each adapter owns its launch child.
}
