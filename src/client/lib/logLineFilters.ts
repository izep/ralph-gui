import { splitLogLine } from "./logTags";

/** Heartbeat: `[olv:plan] meta: … 1m 2s (idle 0s)` */
export function isHeartbeatLine(line: string): boolean {
  const b = line.replace(/^\[[^\]]+\]\s*/, "");
  return /\bmeta:\s*…/.test(b) && /\bidle\b/.test(b);
}

/**
 * After a combined `[copilot:*] A · B · C`, drop the next lines that repeat
 * a segment exactly (server dedupe may already remove most).
 */
export function shouldSuppressCopilotSplitDedup(
  lines: string[],
  index: number,
): boolean {
  if (index <= 0) return false;
  const { tag, body } = splitLogLine(lines[index]!);
  if (!tag.startsWith("[copilot:")) return false;
  const bodyTrim = body.trim();
  for (let i = index - 1; i >= 0 && i >= index - 12; i--) {
    const prev = splitLogLine(lines[i]!);
    if (prev.tag !== tag) break;
    if (!prev.body.includes(" · ")) continue;
    const segments = prev.body.split(" · ").map((s) => s.trim());
    if (segments.includes(bodyTrim)) return true;
    break;
  }
  return false;
}

/** Drop post-phase `[dev]` / `[qa] Feedback:` echoes when streaming already logged the phase. */
export function shouldSuppressRedundantPhaseSummary(
  lines: string[],
  index: number,
): boolean {
  const { tag, body } = splitLogLine(lines[index]!);
  if (tag !== "[dev]" && tag !== "[qa]") return false;
  if (tag === "[qa]" && !body.startsWith("Feedback:")) return false;
  for (let i = index - 1; i >= 0 && i >= index - 400; i--) {
    const t = splitLogLine(lines[i]!).tag;
    if (t.startsWith("[copilot:dev]") && tag === "[dev]") return true;
    if (t.startsWith("[copilot:qa]") && tag === "[qa]") return true;
    if (t === "[ralph]" && /Dev iteration|QA pass/.test(splitLogLine(lines[i]!).body)) {
      break;
    }
  }
  return false;
}

export function shouldOmitLogLine(lines: string[], index: number): boolean {
  const line = lines[index]!;
  if (isHeartbeatLine(line)) return true;
  if (shouldSuppressCopilotSplitDedup(lines, index)) return true;
  if (shouldSuppressRedundantPhaseSummary(lines, index)) return true;
  return false;
}
