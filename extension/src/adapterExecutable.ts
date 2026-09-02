import path from "node:path";

export interface AdapterExecutableSpec {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

function definedEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export function createAdapterExecutableSpec(
  extensionRoot: string,
  electronExecutable: string,
  environment: NodeJS.ProcessEnv,
): AdapterExecutableSpec {
  return {
    command: electronExecutable,
    args: [path.join(extensionRoot, "out", "adapter", "src", "main.js")],
    cwd: extensionRoot,
    env: {
      ...definedEnvironment(environment),
      ELECTRON_RUN_AS_NODE: "1",
    },
  };
}
