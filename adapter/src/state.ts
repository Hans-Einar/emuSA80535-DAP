import type { EmulatorSnapshot } from "./emulatorClient";

export type AdapterLogicalState =
  | "starting"
  | "stopped"
  | "running"
  | "terminating"
  | "terminated";

export type ChildBoundaryState =
  | "starting"
  | "idle-at-boundary"
  | "run-command-active"
  | "other-command-active"
  | "terminating"
  | "exited";

export interface StopEpoch {
  epoch: number;
  snapshot: EmulatorSnapshot;
  frameId: number;
  registersReference: number;
}

export class StopEpochStore {
  private epochCounter = 0;
  private handleCounter = 0;
  private current: StopEpoch | undefined;

  public activate(snapshot: EmulatorSnapshot): StopEpoch {
    const stop: StopEpoch = {
      epoch: ++this.epochCounter,
      snapshot,
      frameId: ++this.handleCounter,
      registersReference: ++this.handleCounter,
    };
    this.current = stop;
    return stop;
  }

  public invalidate(): void {
    this.current = undefined;
  }

  public get active(): StopEpoch | undefined {
    return this.current;
  }

  public get stopEpoch(): number {
    return this.epochCounter;
  }

  public isCurrentFrame(frameId: number): boolean {
    return this.current?.frameId === frameId;
  }

  public isCurrentRegistersReference(variablesReference: number): boolean {
    return this.current?.registersReference === variablesReference;
  }
}
