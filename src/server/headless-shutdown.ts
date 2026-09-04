export type LoopStatusValue = "idle" | "running" | "error" | "stopped";

export type HeadlessShutdown = {
  reason: string;
  exitCode: number;
};

/**
 * `--exit-when-complete` should end the process whenever the loop is no longer
 * running. Otherwise a plan error or max-LLM stop leaves a zombie headless server.
 */
export function headlessShutdownForLoopStatus(
  loopStatus: LoopStatusValue,
  didCompleteEpic: boolean,
): HeadlessShutdown | null {
  if (loopStatus === "error") {
    return { reason: "loop-error", exitCode: 1 };
  }
  if (loopStatus === "idle") {
    return {
      reason: didCompleteEpic ? "epic-complete" : "loop-finished",
      exitCode: 0,
    };
  }
  return null;
}
