import errorRaw from "../../../assets/log-art/error.txt?raw";
import devRaw from "../../../assets/log-art/dev.txt?raw";
import taskRaw from "../../../assets/log-art/task.txt?raw";
import copilotRaw from "../../../assets/log-art/copilot.txt?raw";
import vibeRaw from "../../../assets/log-art/vibe.txt?raw";
import vibeDevRaw from "../../../assets/log-art/vibe-dev.txt?raw";
import vibePlanRaw from "../../../assets/log-art/vibe-plan.txt?raw";
import vibeQaRaw from "../../../assets/log-art/vibe-qa.txt?raw";
import { RALPH_MASCOT_ART } from "./ralphMascotAsset";
import { splitLogLine, tagKind } from "./logTags";

function trimArt(s: string): string {
  return s.trim().replace(/\n+$/, "");
}

/** Channels that may show a header ASCII block (first line in a run only). */
export type LogHeaderChannel =
  | "ralph"
  | "vibe-plan"
  | "vibe-dev"
  | "vibe-qa"
  | "vibe-generic"
  | "dev"
  | "task"
  | "copilot"
  | "error";

export const LOG_HEADER_ART: Record<LogHeaderChannel, string> = {
  ralph: RALPH_MASCOT_ART,
  "vibe-plan": trimArt(vibePlanRaw),
  "vibe-dev": trimArt(vibeDevRaw),
  "vibe-qa": trimArt(vibeQaRaw),
  "vibe-generic": trimArt(vibeRaw),
  dev: trimArt(devRaw),
  task: trimArt(taskRaw),
  copilot: trimArt(copilotRaw),
  error: trimArt(errorRaw),
};

export function getLogHeaderChannel(line: string): LogHeaderChannel | null {
  const { tag } = splitLogLine(line);
  const kind = tagKind(tag, line);
  if (kind === "error") return "error";
  if (tag === "[ralph]") return "ralph";
  if (tag === "[vibe:plan]") return "vibe-plan";
  if (tag === "[vibe:dev]") return "vibe-dev";
  if (tag === "[vibe:qa]") return "vibe-qa";
  if (tag === "[vibe]") return "vibe-generic";
  if (tag === "[dev]") return "dev";
  if (tag === "[task]") return "task";
  if (tag === "[copilot:plan]") return "vibe-plan";
  if (tag === "[copilot:dev]") return "vibe-dev";
  if (tag === "[copilot:qa]") return "vibe-qa";
  if (tag === "[copilot]" || tag.startsWith("[copilot:")) return "copilot";
  if (tag.startsWith("[olv:plan")) return "vibe-plan";
  if (tag.startsWith("[olv:dev")) return "vibe-dev";
  if (tag.startsWith("[olv:qa")) return "vibe-qa";
  if (tag === "[olv]") return "vibe-generic";
  return null;
}

/**
 * When to show the header art: first line of a consecutive run for that channel,
 * and the channel has non-empty art.
 */
export function getLogHeaderBlock(
  lines: string[],
  index: number,
): { channel: LogHeaderChannel; art: string } | null {
  const channel = getLogHeaderChannel(lines[index]);
  if (!channel) return null;
  const art = LOG_HEADER_ART[channel];
  if (!art?.trim()) return null;
  if (index > 0 && getLogHeaderChannel(lines[index - 1]) === channel) {
    return null;
  }
  return { channel, art };
}
