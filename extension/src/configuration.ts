export type DebugConfigurationShape = Record<string, unknown>;

export function applyWorkspaceEmulatorPath<T extends DebugConfigurationShape>(
  configuration: T,
  workspaceEmulatorPath: unknown,
): T {
  if (
    configuration.emulatorPath === undefined &&
    typeof workspaceEmulatorPath === "string" &&
    workspaceEmulatorPath.length > 0
  ) {
    return {
      ...configuration,
      emulatorPath: workspaceEmulatorPath,
    } as T;
  }

  return configuration;
}
